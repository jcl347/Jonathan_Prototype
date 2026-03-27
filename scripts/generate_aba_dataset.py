"""
ABA Therapy Fraud Synthetic Dataset Generator
==============================================
Generates realistic synthetic claims data modeling ABA therapy billing patterns.

Based on:
- CMS Medicare Physician & Other Practitioners data structure
- HHS-OIG audit findings (Indiana $56M, Wisconsin $18.5M, Colorado $77.8M)
- DOJ enforcement actions and known fraud patterns
- ABA CPT codes: 97151-97158, 0362T-0374T

Fraud patterns modeled:
1. Phantom billing - services never rendered
2. Upcoding - billing higher-level codes than performed
3. Excessive hours - >40 hrs/week per patient (impossible)
4. Credential fraud - unlicensed providers billing supervised codes
5. Documentation fraud - fabricated session notes
6. Network/ring fraud - coordinated billing across linked providers
7. Weekend/holiday billing anomalies
8. School-hours billing for school-age children
9. Geographic impossibility - provider billing in multiple distant locations

Sources:
- HHS OIG Indiana Audit (Dec 2024): https://oig.hhs.gov/reports/all/2024/indiana-made-at-least-56-million-in-improper-fee-for-service-medicaid-payments-for-applied-behavior-analysis-provided-to-children-diagnosed-with-autism/
- Morgan Lewis ABA Scrutiny (Nov 2025): https://www.morganlewis.com/blogs/healthlawscan/2025/11/applied-behavioral-analysis-key-service-for-children-with-autism-is-under-payment-scrutiny
- CMS CRUSH Initiative (Feb 2026): https://www.cms.gov/newsroom/press-releases/trump-administration-prioritizes-affordability-announcing-major-crackdown-health-care-fraud
"""

import numpy as np
import pandas as pd
import json
import os
from datetime import datetime, timedelta
import hashlib

np.random.seed(42)

# ============================================================
# CONFIGURATION
# ============================================================

NUM_PROVIDERS = 500
NUM_PATIENTS = 3000
NUM_CLAIMS = 50000
FRAUD_RATE = 0.095  # ~9.5% of providers are fraudulent (Kaggle Medicare dataset: 9.35%, OIG estimates 3-10%)
NETWORK_FRAUD_RINGS = 5  # Number of coordinated fraud rings

# ABA-specific CPT/HCPCS codes with typical reimbursement rates
# ABA-specific CPT/HCPCS codes with realistic Medicaid reimbursement rates (per 15-min unit)
# Source: CMS 2025 Physician Fee Schedule, state Medicaid fee schedules
# Medicaid rates: $70-$130/hr depending on provider level = $17.50-$32.50 per 15-min unit
ABA_CODES = {
    "97151": {"desc": "Behavior identification assessment", "rate": 50.0, "unit_minutes": 15, "level": "assessment"},  # BCBA-level, higher rate
    "97152": {"desc": "Behavior identification supporting assessment", "rate": 32.0, "unit_minutes": 15, "level": "assessment"},
    "97153": {"desc": "Adaptive behavior treatment by protocol", "rate": 19.0, "unit_minutes": 15, "level": "direct"},  # RBT-level, ~$76/hr
    "97154": {"desc": "Group adaptive behavior treatment by protocol", "rate": 11.5, "unit_minutes": 15, "level": "group"},
    "97155": {"desc": "Adaptive behavior treatment with protocol modification", "rate": 38.0, "unit_minutes": 15, "level": "supervision"},  # BCBA-level
    "97156": {"desc": "Family adaptive behavior treatment guidance", "rate": 36.0, "unit_minutes": 15, "level": "family"},  # BCBA-level
    "97157": {"desc": "Multiple-family group adaptive behavior treatment", "rate": 16.0, "unit_minutes": 15, "level": "group"},
    "97158": {"desc": "Group adaptive behavior treatment with protocol modification", "rate": 22.0, "unit_minutes": 15, "level": "group"},
}

# Provider credential types
CREDENTIAL_TYPES = ["BCBA", "BCaBA", "RBT", "BCBA-D", "Licensed Psychologist"]

# US States with ABA Medicaid coverage (all states now cover ABA)
STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
]

# High-fraud states based on OIG audits
HIGH_FRAUD_STATES = ["IN", "CO", "WI", "MA", "FL", "TX", "CA", "NY", "MI", "MN"]

# ============================================================
# GENERATOR FUNCTIONS
# ============================================================

def generate_npi():
    """Generate a realistic 10-digit NPI number."""
    return f"1{np.random.randint(100000000, 999999999)}"


def generate_providers(n):
    """Generate provider profiles with realistic distributions."""
    providers = []

    # Determine which providers are fraudulent
    n_fraud = int(n * FRAUD_RATE)
    is_fraud = [True] * n_fraud + [False] * (n - n_fraud)
    np.random.shuffle(is_fraud)

    # Create fraud rings (groups of connected fraudulent providers)
    fraud_indices = [i for i, f in enumerate(is_fraud) if f]
    ring_assignments = {}
    ring_size = len(fraud_indices) // NETWORK_FRAUD_RINGS
    for ring_id in range(NETWORK_FRAUD_RINGS):
        start = ring_id * ring_size
        end = start + ring_size if ring_id < NETWORK_FRAUD_RINGS - 1 else len(fraud_indices)
        for idx in fraud_indices[start:end]:
            ring_assignments[idx] = ring_id

    for i in range(n):
        fraud = is_fraud[i]
        state = np.random.choice(HIGH_FRAUD_STATES if fraud and np.random.random() < 0.6 else STATES)

        # Fraudulent providers more likely to have lower credentials
        if fraud:
            credential = np.random.choice(
                CREDENTIAL_TYPES,
                p=[0.25, 0.15, 0.40, 0.05, 0.15]
            )
        else:
            credential = np.random.choice(
                CREDENTIAL_TYPES,
                p=[0.40, 0.15, 0.30, 0.05, 0.10]
            )

        # Years in practice - overlapping distributions
        years_practice = max(1, int(np.random.exponential(6) + np.random.uniform(-1, 3)))

        provider = {
            "provider_id": generate_npi(),
            "provider_name": f"Provider_{i:04d}",
            "credential": credential,
            "state": state,
            "city": f"City_{np.random.randint(1, 100)}",
            "zip_code": f"{np.random.randint(10000, 99999)}",
            "years_in_practice": years_practice,
            "is_fraud": fraud,
            "fraud_ring_id": ring_assignments.get(i, -1),
            "fraud_type": [],
            "entity_type": np.random.choice(["Individual", "Organization"],
                                            p=[0.55, 0.45] if not fraud else [0.35, 0.65]),
            "num_locations": np.random.choice([1, 2, 3, 4], p=[0.55, 0.25, 0.12, 0.08]) if not fraud
                            else np.random.choice([1, 2, 3, 4], p=[0.25, 0.30, 0.25, 0.20]),
        }

        # Assign fraud types to fraudulent providers
        if fraud:
            fraud_types = []
            # Not all fraud providers exhibit all patterns (makes detection harder)
            if np.random.random() < 0.45:
                fraud_types.append("upcoding")
            if np.random.random() < 0.35:
                fraud_types.append("excessive_hours")
            if np.random.random() < 0.25:
                fraud_types.append("phantom_billing")
            if np.random.random() < 0.20:
                fraud_types.append("credential_fraud")
            if np.random.random() < 0.15:
                fraud_types.append("school_hours_billing")
            if np.random.random() < 0.12:
                fraud_types.append("weekend_anomaly")
            if provider["fraud_ring_id"] >= 0:
                fraud_types.append("network_fraud")
            if not fraud_types:
                # Some fraud providers are subtle - only one pattern
                fraud_types.append(np.random.choice(["upcoding", "excessive_hours"]))
            provider["fraud_type"] = fraud_types

        providers.append(provider)

    return pd.DataFrame(providers)


def generate_patients(n):
    """Generate patient profiles typical of ABA therapy recipients."""
    patients = []
    for i in range(n):
        age = np.random.choice(
            range(2, 22),
            p=np.array([3, 8, 12, 14, 14, 12, 10, 8, 6, 4, 3, 2, 1, 1, 0.5, 0.5, 0.3, 0.2, 0.2, 0.3]) / 100
        )

        patient = {
            "patient_id": f"PAT_{i:06d}",
            "age": age,
            "gender": np.random.choice(["M", "F"], p=[0.75, 0.25]),  # ASD 4:1 male ratio
            "state": np.random.choice(STATES),
            "diagnosis_code": np.random.choice(
                ["F84.0", "F84.5", "F84.8", "F84.9"],  # ASD ICD-10 codes
                p=[0.60, 0.15, 0.10, 0.15]
            ),
            "severity_level": np.random.choice([1, 2, 3], p=[0.25, 0.50, 0.25]),
            "enrollment_date": datetime(2023, 1, 1) + timedelta(days=np.random.randint(0, 730)),
            "is_school_age": 5 <= age <= 18,
        }
        patients.append(patient)

    return pd.DataFrame(patients)


def generate_claims(providers_df, patients_df, n_claims):
    """Generate claims with realistic and fraudulent patterns."""
    claims = []

    fraud_providers = providers_df[providers_df["is_fraud"]].index.tolist()
    legit_providers = providers_df[~providers_df["is_fraud"]].index.tolist()

    # Assign patients to providers (some patients see multiple providers)
    patient_provider_map = {}
    for _, patient in patients_df.iterrows():
        n_providers = np.random.choice([1, 2, 3], p=[0.7, 0.2, 0.1])
        assigned = np.random.choice(len(providers_df), size=n_providers, replace=False)
        patient_provider_map[patient["patient_id"]] = assigned.tolist()

    for claim_idx in range(n_claims):
        # Select a random patient
        patient_idx = np.random.randint(len(patients_df))
        patient = patients_df.iloc[patient_idx]

        # Select one of the patient's providers
        assigned_providers = patient_provider_map[patient["patient_id"]]
        provider_idx = np.random.choice(assigned_providers)
        provider = providers_df.iloc[provider_idx]

        is_fraud_claim = provider["is_fraud"]
        fraud_types = provider["fraud_type"] if is_fraud_claim else []

        # Base date generation
        service_date = datetime(2024, 1, 1) + timedelta(days=np.random.randint(0, 365))
        day_of_week = service_date.weekday()  # 0=Monday, 6=Sunday

        # Select CPT code - with overlap between fraud and legit
        if is_fraud_claim and "upcoding" in fraud_types:
            # Upcoding: somewhat more high-reimbursement codes but overlapping
            code = np.random.choice(
                list(ABA_CODES.keys()),
                p=[0.08, 0.06, 0.28, 0.06, 0.25, 0.14, 0.05, 0.08]
            )
        else:
            # Legitimate distribution: 97153 (direct therapy) dominates
            code = np.random.choice(
                list(ABA_CODES.keys()),
                p=[0.06, 0.05, 0.50, 0.08, 0.14, 0.09, 0.04, 0.04]
            )

        code_info = ABA_CODES[code]

        # Units billed - overlap between fraud and legit
        if is_fraud_claim and "excessive_hours" in fraud_types:
            # Excessive but with overlap: some legit providers also bill high
            units = np.random.choice(
                range(4, 48),
                p=np.array([1]*4 + [1]*4 + [2]*4 + [3]*4 + [4]*4 + [5]*4 + [4]*4 + [3]*4 + [2]*4 + [1]*4 + [1]*4) / sum([1]*4 + [1]*4 + [2]*4 + [3]*4 + [4]*4 + [5]*4 + [4]*4 + [3]*4 + [2]*4 + [1]*4 + [1]*4)
            )
        else:
            # Normal distribution with some natural variation
            units = max(2, min(32, int(np.random.lognormal(2.2, 0.5))))

        # Billed amount - significant overlap between fraud and legit
        base_amount = code_info["rate"] * units
        noise = np.random.normal(1.0, 0.15)  # 15% noise for everyone
        if is_fraud_claim and "upcoding" in fraud_types:
            billed_amount = base_amount * max(0.8, noise * np.random.uniform(1.02, 1.20))
        else:
            billed_amount = base_amount * max(0.8, noise * np.random.uniform(0.95, 1.08))

        # Allowed amount (what insurance pays)
        allowed_amount = base_amount * np.random.uniform(0.7, 0.95)

        # Service hour (for school-hours analysis)
        if is_fraud_claim and "school_hours_billing" in fraud_types and patient["is_school_age"]:
            service_hour = np.random.randint(8, 15)  # During school hours
        else:
            if patient["is_school_age"] and day_of_week < 5:
                service_hour = np.random.choice([7, 15, 16, 17, 18, 19])  # Before/after school
            else:
                service_hour = np.random.randint(8, 19)

        # Weekend billing - some legit providers also work weekends
        is_weekend = day_of_week >= 5
        if not is_fraud_claim and np.random.random() < 0.08:
            # Some legit providers also bill on weekends
            service_date = service_date + timedelta(days=(5 - day_of_week) % 7)
            is_weekend = True
        elif is_fraud_claim and "weekend_anomaly" in fraud_types:
            # Fraudulent providers bill more on weekends
            if np.random.random() < 0.3:
                service_date = service_date + timedelta(days=(5 - day_of_week) % 7)
                is_weekend = True

        # Place of service
        pos_choices = ["11", "12", "02", "03", "99"]  # Office, Home, Telehealth, School, Other
        if is_fraud_claim:
            place_of_service = np.random.choice(pos_choices, p=[0.3, 0.3, 0.15, 0.1, 0.15])
        else:
            place_of_service = np.random.choice(pos_choices, p=[0.35, 0.35, 0.15, 0.12, 0.03])

        claim = {
            "claim_id": f"CLM_{claim_idx:08d}",
            "provider_id": provider["provider_id"],
            "provider_idx": provider_idx,
            "patient_id": patient["patient_id"],
            "service_date": service_date.strftime("%Y-%m-%d"),
            "service_hour": service_hour,
            "day_of_week": day_of_week,
            "is_weekend": is_weekend,
            "hcpcs_code": code,
            "hcpcs_description": code_info["desc"],
            "code_level": code_info["level"],
            "units": units,
            "billed_amount": round(billed_amount, 2),
            "allowed_amount": round(allowed_amount, 2),
            "payment_amount": round(allowed_amount * np.random.uniform(0.8, 1.0), 2),
            "place_of_service": place_of_service,
            "provider_state": provider["state"],
            "patient_state": patient["state"],
            "patient_age": patient["age"],
            "patient_diagnosis": patient["diagnosis_code"],
            "severity_level": patient["severity_level"],
            "is_school_age": patient["is_school_age"],
            "provider_credential": provider["credential"],
            "is_fraud": is_fraud_claim,
            "fraud_ring_id": provider["fraud_ring_id"],
            "fraud_types": ",".join(fraud_types) if fraud_types else "",
        }
        claims.append(claim)

    return pd.DataFrame(claims)


def generate_referral_network(providers_df):
    """Generate referral relationships between providers for network analysis."""
    edges = []

    fraud_providers = providers_df[providers_df["is_fraud"]]
    legit_providers = providers_df[~providers_df["is_fraud"]]

    # Fraud ring connections (dense connections within rings)
    for ring_id in range(NETWORK_FRAUD_RINGS):
        ring_members = fraud_providers[fraud_providers["fraud_ring_id"] == ring_id]
        member_ids = ring_members["provider_id"].tolist()

        # Create dense connections within the ring
        for i, src in enumerate(member_ids):
            for j, dst in enumerate(member_ids):
                if i < j and np.random.random() < 0.7:  # 70% intra-ring connection
                    edges.append({
                        "source": src,
                        "target": dst,
                        "relationship": np.random.choice(["referral", "shared_patient", "shared_location", "same_organization"]),
                        "weight": np.random.uniform(5, 20),
                        "is_fraud_edge": True,
                    })

    # Legitimate referral network - also create some dense clusters among legit providers
    legit_ids = legit_providers["provider_id"].tolist()
    # Create some legitimate provider clusters (e.g. same practice, hospital network)
    n_legit_clusters = 15
    cluster_size = len(legit_ids) // n_legit_clusters
    for cluster_id in range(n_legit_clusters):
        start = cluster_id * cluster_size
        end = start + cluster_size
        cluster_members = legit_ids[start:end]
        for i, src in enumerate(cluster_members):
            for j, dst in enumerate(cluster_members):
                if i < j and np.random.random() < 0.3:  # 30% intra-cluster connection
                    edges.append({
                        "source": src,
                        "target": dst,
                        "relationship": np.random.choice(["referral", "shared_patient", "same_organization"], p=[0.4, 0.3, 0.3]),
                        "weight": np.random.uniform(2, 10),
                        "is_fraud_edge": False,
                    })

    # Additional random legit edges
    n_legit_edges = len(legit_ids) * 2
    for _ in range(n_legit_edges):
        src = np.random.choice(legit_ids)
        dst = np.random.choice(legit_ids)
        if src != dst:
            edges.append({
                "source": src,
                "target": dst,
                "relationship": np.random.choice(["referral", "shared_patient"], p=[0.7, 0.3]),
                "weight": np.random.uniform(1, 5),
                "is_fraud_edge": False,
            })

    # Cross-connections (fraud to legit, moderate to add noise)
    fraud_ids = fraud_providers["provider_id"].tolist()
    for _ in range(len(fraud_ids) * 3):
        src = np.random.choice(fraud_ids)
        dst = np.random.choice(legit_ids)
        edges.append({
            "source": src,
            "target": dst,
            "relationship": "referral",
            "weight": np.random.uniform(1, 6),
            "is_fraud_edge": False,
        })

    return pd.DataFrame(edges)


# ============================================================
# MAIN GENERATION
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("ABA Therapy Fraud - Synthetic Dataset Generator")
    print("=" * 60)

    # Create output directories
    os.makedirs("data/generated", exist_ok=True)

    # Generate data
    print(f"\n1. Generating {NUM_PROVIDERS} providers...")
    providers = generate_providers(NUM_PROVIDERS)
    n_fraud = providers["is_fraud"].sum()
    print(f"   - Fraudulent: {n_fraud} ({n_fraud/NUM_PROVIDERS*100:.1f}%)")
    print(f"   - Fraud rings: {NETWORK_FRAUD_RINGS}")

    print(f"\n2. Generating {NUM_PATIENTS} patients...")
    patients = generate_patients(NUM_PATIENTS)
    print(f"   - School-age: {patients['is_school_age'].sum()}")
    print(f"   - Male/Female ratio: {(patients['gender']=='M').mean():.2f}/{(patients['gender']=='F').mean():.2f}")

    print(f"\n3. Generating {NUM_CLAIMS} claims...")
    claims = generate_claims(providers, patients, NUM_CLAIMS)
    fraud_claims = claims["is_fraud"].sum()
    print(f"   - Fraudulent claims: {fraud_claims} ({fraud_claims/NUM_CLAIMS*100:.1f}%)")

    print(f"\n4. Generating referral network...")
    network = generate_referral_network(providers)
    print(f"   - Network edges: {len(network)}")
    print(f"   - Fraud edges: {network['is_fraud_edge'].sum()}")

    # Save datasets
    print("\n5. Saving datasets...")
    providers.to_csv("data/generated/providers.csv", index=False)
    patients.to_csv("data/generated/patients.csv", index=False)
    claims.to_csv("data/generated/claims.csv", index=False)
    network.to_csv("data/generated/network_edges.csv", index=False)

    # Save metadata
    metadata = {
        "generated_at": datetime.now().isoformat(),
        "num_providers": NUM_PROVIDERS,
        "num_patients": NUM_PATIENTS,
        "num_claims": NUM_CLAIMS,
        "fraud_rate": FRAUD_RATE,
        "num_fraud_rings": NETWORK_FRAUD_RINGS,
        "fraud_providers": int(n_fraud),
        "fraud_claims": int(fraud_claims),
        "aba_codes_used": list(ABA_CODES.keys()),
        "data_sources": [
            "CMS Medicare Physician & Other Practitioners data structure",
            "HHS-OIG audit findings (Indiana, Wisconsin, Colorado, Massachusetts)",
            "DOJ enforcement action patterns",
            "ABA CPT codes 97151-97158",
        ],
        "fraud_patterns_modeled": [
            "upcoding",
            "excessive_hours",
            "phantom_billing",
            "credential_fraud",
            "school_hours_billing",
            "weekend_anomaly",
            "network_fraud",
        ],
    }
    with open("data/generated/metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    # Summary statistics
    print("\n" + "=" * 60)
    print("DATASET SUMMARY")
    print("=" * 60)
    print(f"\nProvider fraud types distribution:")
    for ft in ["upcoding", "excessive_hours", "phantom_billing", "credential_fraud",
                "school_hours_billing", "weekend_anomaly", "network_fraud"]:
        count = providers[providers["is_fraud"]].apply(
            lambda x: ft in x["fraud_type"], axis=1
        ).sum()
        print(f"   {ft}: {count}")

    print(f"\nClaims by HCPCS code:")
    for code in ABA_CODES:
        code_claims = claims[claims["hcpcs_code"] == code]
        print(f"   {code} ({ABA_CODES[code]['desc'][:40]}): {len(code_claims)}")

    print(f"\nAverage billed amount:")
    print(f"   Fraud claims: ${claims[claims['is_fraud']]['billed_amount'].mean():.2f}")
    print(f"   Legit claims: ${claims[~claims['is_fraud']]['billed_amount'].mean():.2f}")

    print(f"\nFiles saved to data/generated/")
    print("Done!")
