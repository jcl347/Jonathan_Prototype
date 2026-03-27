"""
ABA Therapy Fraud Detection Analysis Pipeline
===============================================
Multi-model approach combining:
1. Feature Engineering (provider-level aggregation)
2. Supervised Learning (XGBoost, Random Forest)
3. Unsupervised Anomaly Detection (Isolation Forest)
4. Network Analytics (Community Detection, PageRank)
5. Benford's Law Analysis

Methodology References:
- Bauder & Khoshgoftaar (2017): "Medicare fraud detection using neural networks"
  https://journalofbigdata.springeropen.com/articles/10.1186/s40537-019-0225-0
- Joudaki et al. (2015): "Using data mining to detect health care fraud and abuse"
- Johnson & Khoshgoftaar (2019): "Medicare fraud detection using machine learning"
- CMS CRUSH Initiative (2026): AI-based "detect and deploy" strategy
- Graph-based fraud detection: Louvain community detection + PageRank
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12647751/
"""

import numpy as np
import pandas as pd
import json
import os
import warnings
from datetime import datetime

from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_auc_score,
    precision_recall_curve, average_precision_score, f1_score
)
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.inspection import permutation_importance
import xgboost as xgb
import networkx as nx

warnings.filterwarnings('ignore')

# ============================================================
# 1. LOAD DATA
# ============================================================

def load_data():
    """Load generated datasets."""
    providers = pd.read_csv("data/generated/providers.csv")
    claims = pd.read_csv("data/generated/claims.csv")
    network = pd.read_csv("data/generated/network_edges.csv")
    patients = pd.read_csv("data/generated/patients.csv")
    return providers, claims, network, patients


# ============================================================
# 2. FEATURE ENGINEERING
# ============================================================

def engineer_provider_features(claims, providers, network):
    """
    Create provider-level features for fraud detection.

    Feature categories based on literature review:
    - Volume metrics (claim count, total billed)
    - Billing pattern features (code distribution, avg units)
    - Temporal features (weekend ratio, school hours ratio)
    - Geographic features (state mismatch, multi-location)
    - Network features (degree, PageRank, community)
    - Benford's Law deviation
    - Statistical anomaly scores
    """
    features = {}

    # --- Volume Features ---
    vol = claims.groupby("provider_id").agg(
        total_claims=("claim_id", "count"),
        total_billed=("billed_amount", "sum"),
        total_allowed=("allowed_amount", "sum"),
        total_payment=("payment_amount", "sum"),
        avg_billed=("billed_amount", "mean"),
        std_billed=("billed_amount", "std"),
        max_billed=("billed_amount", "max"),
        unique_patients=("patient_id", "nunique"),
        avg_units=("units", "mean"),
        max_units=("units", "max"),
        std_units=("units", "std"),
    ).fillna(0)
    features["volume"] = vol

    # --- Billing Pattern Features ---
    # Code distribution (proportion of each HCPCS code)
    code_dist = claims.pivot_table(
        index="provider_id",
        columns="hcpcs_code",
        values="claim_id",
        aggfunc="count",
        fill_value=0
    )
    code_dist = code_dist.div(code_dist.sum(axis=1), axis=0)
    code_dist.columns = [f"code_ratio_{c}" for c in code_dist.columns]
    features["code_dist"] = code_dist

    # High-reimbursement code ratio (97155, 97151 are highest-paying)
    high_reimb_codes = ["97155", "97151", "97156"]
    claims["is_high_reimb"] = claims["hcpcs_code"].isin(high_reimb_codes)
    high_reimb = claims.groupby("provider_id")["is_high_reimb"].mean()
    high_reimb.name = "high_reimb_code_ratio"

    # Billed-to-allowed ratio (indicator of upcoding)
    bill_ratio = claims.groupby("provider_id").apply(
        lambda x: (x["billed_amount"].sum() / x["allowed_amount"].sum()) if x["allowed_amount"].sum() > 0 else 0
    )
    bill_ratio.name = "billed_to_allowed_ratio"

    # Claims per patient (high ratio = possible phantom billing)
    claims_per_patient = claims.groupby("provider_id").apply(
        lambda x: x["claim_id"].count() / max(x["patient_id"].nunique(), 1)
    )
    claims_per_patient.name = "claims_per_patient"

    features["billing"] = pd.DataFrame({
        "high_reimb_code_ratio": high_reimb,
        "billed_to_allowed_ratio": bill_ratio,
        "claims_per_patient": claims_per_patient,
    })

    # --- Temporal Features ---
    claims["service_date"] = pd.to_datetime(claims["service_date"])
    claims["month"] = claims["service_date"].dt.month

    # Weekend billing ratio
    weekend = claims.groupby("provider_id")["is_weekend"].mean()
    weekend.name = "weekend_billing_ratio"

    # School hours billing ratio (for school-age patients)
    school_age_claims = claims[claims["is_school_age"]]
    school_hours = school_age_claims.groupby("provider_id").apply(
        lambda x: ((x["service_hour"] >= 8) & (x["service_hour"] <= 14) & (x["day_of_week"] < 5)).mean()
        if len(x) > 0 else 0
    )
    school_hours.name = "school_hours_ratio"

    # Billing consistency (entropy of monthly distribution)
    monthly = claims.groupby(["provider_id", "month"]).size().unstack(fill_value=0)
    billing_entropy = monthly.apply(
        lambda x: -sum((p/x.sum()) * np.log2(p/x.sum() + 1e-10) for p in x if p > 0),
        axis=1
    )
    billing_entropy.name = "billing_entropy"

    features["temporal"] = pd.DataFrame({
        "weekend_billing_ratio": weekend,
        "school_hours_ratio": school_hours,
        "billing_entropy": billing_entropy,
    })

    # --- Geographic Features ---
    state_mismatch = claims.groupby("provider_id").apply(
        lambda x: (x["provider_state"] != x["patient_state"]).mean()
    )
    state_mismatch.name = "state_mismatch_ratio"

    unique_patient_states = claims.groupby("provider_id")["patient_state"].nunique()
    unique_patient_states.name = "unique_patient_states"

    features["geographic"] = pd.DataFrame({
        "state_mismatch_ratio": state_mismatch,
        "unique_patient_states": unique_patient_states,
    })

    # --- Benford's Law Analysis ---
    def benfords_deviation(amounts):
        """Calculate deviation from Benford's Law for leading digits."""
        if len(amounts) < 10:
            return 0.0
        leading_digits = amounts.astype(str).str[0].astype(int)
        leading_digits = leading_digits[leading_digits > 0]
        if len(leading_digits) == 0:
            return 0.0
        observed = leading_digits.value_counts(normalize=True).reindex(range(1, 10), fill_value=0)
        expected = pd.Series(
            [np.log10(1 + 1/d) for d in range(1, 10)],
            index=range(1, 10)
        )
        return np.sqrt(((observed - expected) ** 2).sum())

    benford = claims.groupby("provider_id")["billed_amount"].apply(
        lambda x: benfords_deviation(x.round(0).astype(int).abs())
    )
    benford.name = "benfords_deviation"
    features["benford"] = pd.DataFrame({"benfords_deviation": benford})

    # --- Network Features ---
    G = nx.Graph()
    for _, row in network.iterrows():
        G.add_edge(row["source"], row["target"], weight=row["weight"],
                    relationship=row["relationship"])

    # Add isolated providers
    for pid in providers["provider_id"]:
        if pid not in G:
            G.add_node(pid)

    # Degree centrality
    degree = pd.Series(dict(G.degree(weight="weight")), name="weighted_degree")

    # PageRank
    pagerank = pd.Series(nx.pagerank(G, weight="weight"), name="pagerank")

    # Betweenness centrality
    betweenness = pd.Series(nx.betweenness_centrality(G, weight="weight"), name="betweenness")

    # Community detection (Louvain)
    communities = nx.community.louvain_communities(G, weight="weight", seed=42)
    community_map = {}
    community_sizes = {}
    for idx, community in enumerate(communities):
        community_sizes[idx] = len(community)
        for node in community:
            community_map[node] = idx

    community_id = pd.Series(community_map, name="community_id")
    community_size = community_id.map(community_sizes)
    community_size.name = "community_size"

    # Clustering coefficient
    clustering = pd.Series(nx.clustering(G, weight="weight"), name="clustering_coeff")

    network_features = pd.DataFrame({
        "weighted_degree": degree,
        "pagerank": pagerank,
        "betweenness": betweenness,
        "community_id": community_id,
        "community_size": community_size,
        "clustering_coeff": clustering,
    })
    features["network"] = network_features

    # --- Combine All Features ---
    provider_ids = providers.set_index("provider_id")[["is_fraud", "fraud_ring_id", "credential", "entity_type", "years_in_practice", "num_locations"]]

    # Encode categorical features
    le_cred = LabelEncoder()
    provider_ids["credential_encoded"] = le_cred.fit_transform(provider_ids["credential"])
    le_entity = LabelEncoder()
    provider_ids["entity_type_encoded"] = le_entity.fit_transform(provider_ids["entity_type"])

    feature_df = provider_ids.copy()
    for name, feat in features.items():
        feature_df = feature_df.join(feat, how="left")

    feature_df = feature_df.fillna(0)

    return feature_df, G, communities, community_map


# ============================================================
# 3. SUPERVISED MODELS
# ============================================================

def train_models(feature_df):
    """Train XGBoost and Random Forest models with cross-validation."""
    # Prepare features
    # Exclude label-leaking columns and network-structural features
    # Network features (clustering, degree, betweenness) are used separately in network analysis
    exclude_cols = [
        "is_fraud", "fraud_ring_id", "credential", "entity_type",
        "community_id", "community_size", "clustering_coeff",
        "weighted_degree", "betweenness", "pagerank",
    ]
    feature_cols = [c for c in feature_df.columns if c not in exclude_cols]
    X = feature_df[feature_cols].values
    y = feature_df["is_fraud"].astype(int).values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    results = {}

    # --- XGBoost ---
    xgb_model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        scale_pos_weight=len(y[y == 0]) / max(len(y[y == 1]), 1),
        eval_metric="logloss",
        random_state=42,
        use_label_encoder=False,
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    xgb_scores = cross_val_score(xgb_model, X_scaled, y, cv=cv, scoring="roc_auc")

    # Train on full data for feature importance
    xgb_model.fit(X_scaled, y)
    xgb_probs = xgb_model.predict_proba(X_scaled)[:, 1]
    xgb_preds = xgb_model.predict(X_scaled)

    results["xgboost"] = {
        "model": xgb_model,
        "cv_auc_mean": xgb_scores.mean(),
        "cv_auc_std": xgb_scores.std(),
        "predictions": xgb_preds,
        "probabilities": xgb_probs,
        "feature_importance": dict(zip(feature_cols, xgb_model.feature_importances_)),
    }

    # --- Random Forest ---
    rf_model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        class_weight="balanced",
        random_state=42,
    )

    rf_scores = cross_val_score(rf_model, X_scaled, y, cv=cv, scoring="roc_auc")
    rf_model.fit(X_scaled, y)
    rf_probs = rf_model.predict_proba(X_scaled)[:, 1]
    rf_preds = rf_model.predict(X_scaled)

    results["random_forest"] = {
        "model": rf_model,
        "cv_auc_mean": rf_scores.mean(),
        "cv_auc_std": rf_scores.std(),
        "predictions": rf_preds,
        "probabilities": rf_probs,
        "feature_importance": dict(zip(feature_cols, rf_model.feature_importances_)),
    }

    # --- Isolation Forest (Unsupervised) ---
    iso_model = IsolationForest(
        n_estimators=200,
        contamination=0.10,  # Slightly above actual fraud rate for sensitivity
        random_state=42,
    )
    iso_preds_raw = iso_model.fit_predict(X_scaled)
    iso_scores = iso_model.decision_function(X_scaled)
    iso_preds = (iso_preds_raw == -1).astype(int)

    results["isolation_forest"] = {
        "model": iso_model,
        "predictions": iso_preds,
        "anomaly_scores": -iso_scores,  # Higher = more anomalous
        "auc": roc_auc_score(y, -iso_scores),
    }

    return results, feature_cols, scaler


# ============================================================
# 4. NETWORK ANALYSIS
# ============================================================

def analyze_network(G, communities, community_map, providers):
    """Perform network-level fraud analysis."""
    provider_fraud = providers.set_index("provider_id")["is_fraud"].to_dict()

    # Analyze each community for fraud concentration
    community_analysis = []
    for idx, community in enumerate(communities):
        community_providers = list(community)
        n_providers = len(community_providers)
        n_fraud = sum(1 for p in community_providers if provider_fraud.get(p, False))
        fraud_rate = n_fraud / n_providers if n_providers > 0 else 0

        # Subgraph metrics
        subgraph = G.subgraph(community_providers)
        density = nx.density(subgraph)
        avg_clustering = nx.average_clustering(subgraph) if n_providers > 1 else 0

        community_analysis.append({
            "community_id": idx,
            "size": n_providers,
            "fraud_count": n_fraud,
            "fraud_rate": round(fraud_rate, 3),
            "density": round(density, 4),
            "avg_clustering": round(avg_clustering, 4),
            "is_suspicious": fraud_rate > 0.3 and n_providers >= 3,
            "providers": community_providers,
        })

    return sorted(community_analysis, key=lambda x: x["fraud_rate"], reverse=True)


# ============================================================
# 5. GENERATE RESULTS FOR WEBSITE
# ============================================================

def generate_website_data(feature_df, model_results, community_analysis, providers, claims, G):
    """Generate JSON data for the Next.js website."""
    os.makedirs("public/data", exist_ok=True)

    # --- Provider Risk Scores ---
    provider_risk = feature_df.copy()
    provider_risk["xgb_fraud_prob"] = model_results["xgboost"]["probabilities"]
    provider_risk["rf_fraud_prob"] = model_results["random_forest"]["probabilities"]
    provider_risk["iso_anomaly_score"] = model_results["isolation_forest"]["anomaly_scores"]

    # Ensemble score (weighted average)
    provider_risk["ensemble_score"] = (
        0.4 * provider_risk["xgb_fraud_prob"] +
        0.3 * provider_risk["rf_fraud_prob"] +
        0.3 * (provider_risk["iso_anomaly_score"] - provider_risk["iso_anomaly_score"].min()) /
        (provider_risk["iso_anomaly_score"].max() - provider_risk["iso_anomaly_score"].min())
    )

    # Risk categories
    provider_risk["risk_level"] = pd.cut(
        provider_risk["ensemble_score"],
        bins=[0, 0.3, 0.6, 0.8, 1.0],
        labels=["Low", "Medium", "High", "Critical"]
    )

    # Provider summary for website
    provider_summary = []
    for pid, row in provider_risk.iterrows():
        prov_claims = claims[claims["provider_id"] == pid]
        provider_info = providers[providers["provider_id"] == pid].iloc[0] if len(providers[providers["provider_id"] == pid]) > 0 else None

        summary = {
            "provider_id": pid,
            "provider_name": provider_info["provider_name"] if provider_info is not None else f"Unknown_{pid[:8]}",
            "state": provider_info["state"] if provider_info is not None else "Unknown",
            "credential": row.get("credential", "Unknown"),
            "entity_type": row.get("entity_type", "Unknown"),
            "years_in_practice": int(row.get("years_in_practice", 0)),
            "total_claims": int(row.get("total_claims", 0)),
            "total_billed": float(row.get("total_billed", 0)),
            "unique_patients": int(row.get("unique_patients", 0)),
            "ensemble_score": round(float(row["ensemble_score"]), 4),
            "xgb_score": round(float(row["xgb_fraud_prob"]), 4),
            "rf_score": round(float(row["rf_fraud_prob"]), 4),
            "iso_score": round(float(row["iso_anomaly_score"]), 4),
            "risk_level": str(row["risk_level"]),
            "is_actual_fraud": bool(row["is_fraud"]),
            "high_reimb_ratio": round(float(row.get("high_reimb_code_ratio", 0)), 4),
            "weekend_ratio": round(float(row.get("weekend_billing_ratio", 0)), 4),
            "school_hours_ratio": round(float(row.get("school_hours_ratio", 0)), 4),
            "billed_to_allowed_ratio": round(float(row.get("billed_to_allowed_ratio", 0)), 4),
            "claims_per_patient": round(float(row.get("claims_per_patient", 0)), 2),
            "benfords_deviation": round(float(row.get("benfords_deviation", 0)), 4),
            "pagerank": round(float(row.get("pagerank", 0)), 6),
            "community_id": int(row.get("community_id", -1)),
            "community_size": int(row.get("community_size", 0)),
            "weighted_degree": round(float(row.get("weighted_degree", 0)), 2),
        }
        provider_summary.append(summary)

    provider_summary.sort(key=lambda x: x["ensemble_score"], reverse=True)

    # --- Model Performance ---
    y_true = feature_df["is_fraud"].astype(int).values

    model_performance = {
        "xgboost": {
            "cv_auc_mean": round(model_results["xgboost"]["cv_auc_mean"], 4),
            "cv_auc_std": round(model_results["xgboost"]["cv_auc_std"], 4),
            "classification_report": classification_report(
                y_true, model_results["xgboost"]["predictions"], output_dict=True
            ),
        },
        "random_forest": {
            "cv_auc_mean": round(model_results["random_forest"]["cv_auc_mean"], 4),
            "cv_auc_std": round(model_results["random_forest"]["cv_auc_std"], 4),
            "classification_report": classification_report(
                y_true, model_results["random_forest"]["predictions"], output_dict=True
            ),
        },
        "isolation_forest": {
            "auc": round(model_results["isolation_forest"]["auc"], 4),
            "classification_report": classification_report(
                y_true, model_results["isolation_forest"]["predictions"], output_dict=True
            ),
        },
    }

    # --- Feature Importance ---
    xgb_imp = model_results["xgboost"]["feature_importance"]
    rf_imp = model_results["random_forest"]["feature_importance"]

    feature_importance = []
    for feat in xgb_imp:
        feature_importance.append({
            "feature": feat,
            "xgb_importance": round(float(xgb_imp[feat]), 4),
            "rf_importance": round(float(rf_imp.get(feat, 0)), 4),
            "avg_importance": round(float((xgb_imp[feat] + rf_imp.get(feat, 0)) / 2), 4),
        })
    feature_importance.sort(key=lambda x: x["avg_importance"], reverse=True)

    # --- Network Graph Data ---
    nodes = []
    for node in G.nodes():
        prov = providers[providers["provider_id"] == node]
        risk_row = provider_risk.loc[node] if node in provider_risk.index else None
        nodes.append({
            "id": node,
            "name": prov.iloc[0]["provider_name"] if len(prov) > 0 else node[:10],
            "state": prov.iloc[0]["state"] if len(prov) > 0 else "Unknown",
            "is_fraud": bool(prov.iloc[0]["is_fraud"]) if len(prov) > 0 else False,
            "risk_score": round(float(risk_row["ensemble_score"]), 4) if risk_row is not None else 0,
            "community_id": int(risk_row.get("community_id", -1)) if risk_row is not None else -1,
            "degree": G.degree(node),
        })

    edges = []
    for u, v, data in G.edges(data=True):
        edges.append({
            "source": u,
            "target": v,
            "weight": round(float(data.get("weight", 1)), 2),
            "relationship": data.get("relationship", "unknown"),
        })

    network_data = {"nodes": nodes, "edges": edges}

    # --- Community Analysis ---
    community_data = []
    for ca in community_analysis:
        ca_copy = ca.copy()
        ca_copy["providers"] = ca["providers"][:20]  # Limit for JSON
        community_data.append(ca_copy)

    # --- Claims Distribution ---
    claims_dist = {
        "by_code": claims.groupby("hcpcs_code").agg(
            count=("claim_id", "count"),
            avg_billed=("billed_amount", "mean"),
            total_billed=("billed_amount", "sum"),
        ).reset_index().to_dict("records"),
        "fraud_vs_legit": {
            "fraud": {
                "avg_billed": round(claims[claims["is_fraud"]]["billed_amount"].mean(), 2),
                "avg_units": round(claims[claims["is_fraud"]]["units"].mean(), 2),
                "total_billed": round(claims[claims["is_fraud"]]["billed_amount"].sum(), 2),
            },
            "legit": {
                "avg_billed": round(claims[~claims["is_fraud"]]["billed_amount"].mean(), 2),
                "avg_units": round(claims[~claims["is_fraud"]]["units"].mean(), 2),
                "total_billed": round(claims[~claims["is_fraud"]]["billed_amount"].sum(), 2),
            },
        },
        "by_month": claims.groupby(claims["service_date"].dt.month).agg(
            total=("claim_id", "count"),
            fraud=("is_fraud", "sum"),
        ).reset_index().to_dict("records"),
    }

    # --- Save all JSON files ---
    # Custom JSON encoder to handle numpy types
    class NumpyEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, (np.integer,)):
                return int(obj)
            if isinstance(obj, (np.floating,)):
                return float(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            if isinstance(obj, (np.bool_,)):
                return bool(obj)
            return super().default(obj)

    with open("public/data/providers.json", "w") as f:
        json.dump(provider_summary, f, cls=NumpyEncoder)

    with open("public/data/model_performance.json", "w") as f:
        json.dump(model_performance, f, cls=NumpyEncoder)

    with open("public/data/feature_importance.json", "w") as f:
        json.dump(feature_importance, f, cls=NumpyEncoder)

    with open("public/data/network.json", "w") as f:
        json.dump(network_data, f, cls=NumpyEncoder)

    with open("public/data/communities.json", "w") as f:
        json.dump(community_data, f, cls=NumpyEncoder)

    with open("public/data/claims_distribution.json", "w") as f:
        json.dump(claims_dist, f, cls=NumpyEncoder)

    print(f"Website data saved to public/data/")
    return provider_risk


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("ABA Therapy Fraud Detection - Analysis Pipeline")
    print("=" * 60)

    # Load data
    print("\n1. Loading data...")
    providers, claims, network, patients = load_data()

    # Feature engineering
    print("\n2. Engineering features...")
    feature_df, G, communities, community_map = engineer_provider_features(claims, providers, network)
    print(f"   Features: {feature_df.shape[1]} columns for {feature_df.shape[0]} providers")

    # Train models
    print("\n3. Training models...")
    model_results, feature_cols, scaler = train_models(feature_df)
    print(f"   XGBoost CV AUC: {model_results['xgboost']['cv_auc_mean']:.4f} +/- {model_results['xgboost']['cv_auc_std']:.4f}")
    print(f"   Random Forest CV AUC: {model_results['random_forest']['cv_auc_mean']:.4f} +/- {model_results['random_forest']['cv_auc_std']:.4f}")
    print(f"   Isolation Forest AUC: {model_results['isolation_forest']['auc']:.4f}")

    # Network analysis
    print("\n4. Analyzing network...")
    community_analysis = analyze_network(G, communities, community_map, providers)
    suspicious = [c for c in community_analysis if c["is_suspicious"]]
    print(f"   Communities detected: {len(communities)}")
    print(f"   Suspicious communities: {len(suspicious)}")

    # Top feature importances
    print("\n5. Top 10 Features (XGBoost):")
    imp = model_results["xgboost"]["feature_importance"]
    for feat, score in sorted(imp.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"   {feat}: {score:.4f}")

    # Classification reports
    y_true = feature_df["is_fraud"].astype(int).values
    print("\n6. XGBoost Classification Report:")
    print(classification_report(y_true, model_results["xgboost"]["predictions"],
                                target_names=["Legitimate", "Fraudulent"]))

    # Generate website data
    print("\n7. Generating website data...")
    provider_risk = generate_website_data(feature_df, model_results, community_analysis, providers, claims, G)

    # Summary stats
    print("\n" + "=" * 60)
    print("ANALYSIS COMPLETE")
    print("=" * 60)
    risk_counts = provider_risk["risk_level"].value_counts()
    print(f"\nRisk Level Distribution:")
    for level in ["Critical", "High", "Medium", "Low"]:
        count = risk_counts.get(level, 0)
        print(f"   {level}: {count} providers")

    print(f"\nTop 10 Highest Risk Providers:")
    top = provider_risk.nlargest(10, "ensemble_score")
    for pid, row in top.iterrows():
        pid_str = str(pid)
        print(f"   {pid_str[:15]}... Score: {row['ensemble_score']:.4f} | Actual Fraud: {row['is_fraud']}")

    print("\nDone!")
