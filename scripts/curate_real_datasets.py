"""
Curate Real Datasets for ABA Fraud Detection
=============================================
Downloads and processes publicly available government datasets:
1. LEIE (List of Excluded Individuals/Entities) - HHS OIG
2. Generates ABA-specific filtered views

Sources:
- LEIE: https://oig.hhs.gov/exclusions/exclusions_list.asp
- CMS Medicare Provider Data: https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners
"""

import pandas as pd
import numpy as np
import json
import os
import subprocess
from datetime import datetime

OUTPUT_DIR = "public/data"

# ABA-related specialties in LEIE
ABA_SPECIALTIES = [
    "BEHAVIORAL ANALYST",
    "BEHAVIOR ANALYST",
    "APPLIED BEHAVIOR",
    "BEHAVIORAL HEALTH",
    "AUTISM",
    "ABA",
    "BEHAVIORAL THERAPY",
    "MENTAL HEALTH",
    "PSYCHOLOGIST",
    "PSYCHOLOGY",
    "COUNSELOR",
    "SOCIAL WORKER",
    "DEVELOPMENTAL",
    "SPEECH",
    "OCCUPATIONAL THERAPY",
]

# Broader healthcare specialties for comparison
HEALTHCARE_SPECIALTIES = [
    "HOME HEALTH",
    "NURSING",
    "PHARMACY",
    "PHYSICIAN",
    "CLINIC",
    "HOSPITAL",
    "LABORATORY",
    "DME",
    "AMBULANCE",
    "PERSONAL CARE",
]


def download_leie():
    """Download LEIE exclusion list from HHS OIG."""
    leie_path = "data/real/leie_updated.csv"
    os.makedirs("data/real", exist_ok=True)

    if os.path.exists(leie_path):
        print(f"   LEIE already downloaded: {leie_path}")
        return leie_path

    print("   Downloading LEIE from oig.hhs.gov...")
    result = subprocess.run(
        ["curl", "-sL", "https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv",
         "-o", leie_path],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        print(f"   ERROR: Failed to download LEIE: {result.stderr}")
        return None

    print(f"   Downloaded LEIE to {leie_path}")
    return leie_path


def process_leie(leie_path):
    """Process LEIE data into ABA-focused analysis."""
    print("   Processing LEIE data...")
    df = pd.read_csv(leie_path, dtype=str, low_memory=False)
    df.columns = df.columns.str.strip()

    total_records = len(df)
    print(f"   Total LEIE records: {total_records}")

    # Parse dates
    df["EXCLDATE_parsed"] = pd.to_datetime(df["EXCLDATE"], format="%Y%m%d", errors="coerce")
    df["excl_year"] = df["EXCLDATE_parsed"].dt.year

    # Identify behavioral health / ABA-related exclusions
    specialty_col = df["SPECIALTY"].fillna("") + " " + df["GENERAL"].fillna("")
    specialty_col = specialty_col.str.upper()

    df["is_aba_related"] = specialty_col.apply(
        lambda x: any(s in x for s in ABA_SPECIALTIES)
    )

    df["is_healthcare_provider"] = specialty_col.apply(
        lambda x: any(s in x for s in HEALTHCARE_SPECIALTIES + ABA_SPECIALTIES)
    )

    # Exclusion type descriptions
    excl_type_map = {
        "1128a1": "Conviction - Program-Related Crimes",
        "1128a2": "Conviction - Patient Abuse/Neglect",
        "1128a3": "Conviction - Healthcare Fraud Felony",
        "1128a4": "Conviction - Controlled Substance Felony",
        "1128b1": "Misdemeanor - Healthcare Fraud",
        "1128b2": "Misdemeanor - Other Fraud",
        "1128b4": "License Revocation/Suspension",
        "1128b5": "Exclusion from State Program",
        "1128b6": "Excessive Claims/Furnishing Unnecessary Services",
        "1128b7": "Fraud/Kickbacks/Other Prohibited Activities",
        "1128b8": "Ownership of Sanctioned Entity",
        "1128b14": "Default on Student Loan",
        "1128b15": "Individuals Controlling Sanctioned Entity",
        "1128b16": "Making False Statement",
    }
    df["excl_type_desc"] = df["EXCLTYPE"].map(excl_type_map).fillna("Other")

    # --- Generate summaries for website ---

    # 1. ABA-related exclusions by year
    aba_by_year = (
        df[df["is_aba_related"]]
        .groupby("excl_year")
        .size()
        .reset_index(name="count")
    )
    aba_by_year = aba_by_year[aba_by_year["excl_year"] >= 2015]
    aba_by_year = aba_by_year.sort_values("excl_year")

    # 2. ABA exclusions by state
    aba_by_state = (
        df[df["is_aba_related"]]
        .groupby("STATE")
        .size()
        .reset_index(name="count")
        .sort_values("count", ascending=False)
        .head(25)
    )

    # 3. Exclusion type distribution for ABA-related
    aba_by_type = (
        df[df["is_aba_related"]]
        .groupby("excl_type_desc")
        .size()
        .reset_index(name="count")
        .sort_values("count", ascending=False)
    )

    # 4. All exclusions by year (for comparison)
    all_by_year = (
        df.groupby("excl_year")
        .size()
        .reset_index(name="count")
    )
    all_by_year = all_by_year[all_by_year["excl_year"] >= 2015]

    # 5. Top specialties in exclusion list
    specialty_dist = (
        df["SPECIALTY"]
        .fillna("Unknown")
        .str.strip()
        .value_counts()
        .head(20)
        .reset_index()
    )
    specialty_dist.columns = ["specialty", "count"]

    # 6. ABA-related provider details (for the provider table)
    aba_providers = df[df["is_aba_related"]].copy()
    aba_providers = aba_providers.sort_values("EXCLDATE_parsed", ascending=False)

    provider_list = []
    for _, row in aba_providers.head(200).iterrows():
        name = " ".join(filter(None, [
            str(row.get("FIRSTNAME", "")).strip(),
            str(row.get("MIDNAME", "")).strip(),
            str(row.get("LASTNAME", "")).strip(),
        ])).strip()
        if not name or name == "nan nan nan":
            name = str(row.get("BUSNAME", "Unknown")).strip()

        provider_list.append({
            "provider_id": str(row.get("NPI", "N/A")).strip(),
            "provider_name": name[:50],
            "state": str(row.get("STATE", "N/A")).strip(),
            "credential": str(row.get("SPECIALTY", "Unknown")).strip(),
            "entity_type": "Organization" if row.get("BUSNAME") and str(row.get("BUSNAME")).strip() else "Individual",
            "exclusion_type": str(row.get("excl_type_desc", "Unknown")),
            "exclusion_date": str(row.get("EXCLDATE", "Unknown")),
            "city": str(row.get("CITY", "")).strip(),
            "risk_level": "Critical",
            "ensemble_score": 1.0,
            "is_actual_fraud": True,
            "total_claims": 0,
            "total_billed": 0,
            "unique_patients": 0,
        })

    # 7. Summary statistics
    summary = {
        "dataset": "LEIE (List of Excluded Individuals/Entities)",
        "source": "HHS Office of Inspector General",
        "url": "https://oig.hhs.gov/exclusions/exclusions_list.asp",
        "total_records": total_records,
        "aba_related": int(df["is_aba_related"].sum()),
        "healthcare_providers": int(df["is_healthcare_provider"].sum()),
        "date_range": f"{int(df['excl_year'].min())}-{int(df['excl_year'].max())}",
        "last_updated": datetime.now().strftime("%Y-%m-%d"),
        "states_represented": int(df["STATE"].nunique()),
    }

    # Build the dataset JSON
    leie_dataset = {
        "metadata": summary,
        "providers": provider_list,
        "aba_by_year": aba_by_year.to_dict("records"),
        "aba_by_state": aba_by_state.to_dict("records"),
        "aba_by_type": aba_by_type.to_dict("records"),
        "all_by_year": all_by_year.to_dict("records"),
        "specialty_dist": specialty_dist.to_dict("records"),
        "model_performance": {
            "note": "LEIE is a ground-truth exclusion list, not a predictive model. All listed providers have been formally excluded from federal healthcare programs.",
            "source": "HHS-OIG enforcement actions and state referrals",
        },
    }

    return leie_dataset


def generate_cms_placeholder():
    """Generate a placeholder for CMS Medicare data with instructions."""
    return {
        "metadata": {
            "dataset": "CMS Medicare Physician & Other Practitioners",
            "source": "Centers for Medicare & Medicaid Services",
            "url": "https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service",
            "status": "requires_manual_download",
            "instructions": [
                "1. Visit the dataset URL above",
                "2. Click 'Download Full Dataset' for the most recent year",
                "3. Filter by HCPCS codes: 97151, 97152, 97153, 97154, 97155, 97156, 97157, 97158",
                "4. Place the filtered CSV in data/real/cms_aba_providers.csv",
                "5. Re-run this script to process the data",
            ],
            "notes": "This dataset contains actual Medicare claims data aggregated by NPI and HCPCS code. Most ABA therapy is Medicaid-funded, so this represents only the Medicare subset.",
            "aba_hcpcs_codes": {
                "97151": "Behavior identification assessment",
                "97152": "Behavior identification supporting assessment",
                "97153": "Adaptive behavior treatment by protocol (most common)",
                "97154": "Group adaptive behavior treatment by protocol",
                "97155": "Adaptive behavior treatment with protocol modification",
                "97156": "Family adaptive behavior treatment guidance",
                "97157": "Multiple-family group treatment",
                "97158": "Group treatment with protocol modification",
            },
        },
        "providers": [],
    }


if __name__ == "__main__":
    print("=" * 60)
    print("Curating Real Datasets for ABA Fraud Detection")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Download and process LEIE
    print("\n1. LEIE Exclusion List...")
    leie_path = download_leie()
    if leie_path:
        leie_data = process_leie(leie_path)
        with open(f"{OUTPUT_DIR}/leie_dataset.json", "w") as f:
            json.dump(leie_data, f, default=str)
        print(f"   Saved LEIE dataset: {leie_data['metadata']['aba_related']} ABA-related exclusions")
        print(f"   Total records: {leie_data['metadata']['total_records']}")

    # 2. CMS Medicare data placeholder
    print("\n2. CMS Medicare Provider Data...")
    cms_data = generate_cms_placeholder()
    with open(f"{OUTPUT_DIR}/cms_dataset.json", "w") as f:
        json.dump(cms_data, f)
    print(f"   Generated CMS placeholder with download instructions")

    # 3. Dataset index
    datasets_index = {
        "datasets": [
            {
                "id": "synthetic",
                "name": "Synthetic ABA Fraud Dataset",
                "description": "ML-generated dataset modeled on OIG audit findings. 500 providers, 50K claims, ~9.5% fraud rate.",
                "source": "Generated (this project)",
                "reliability": "6/10 (training) / 3/10 (evidence)",
                "has_data": True,
                "files": ["providers.json", "model_performance.json", "feature_importance.json", "network.json", "communities.json", "claims_distribution.json"],
            },
            {
                "id": "leie",
                "name": "LEIE Exclusion List (HHS-OIG)",
                "description": "Official government list of individuals/entities excluded from federal healthcare programs. Ground-truth fraud labels.",
                "source": "HHS Office of Inspector General",
                "url": "https://oig.hhs.gov/exclusions/exclusions_list.asp",
                "reliability": "10/10",
                "has_data": True,
                "files": ["leie_dataset.json"],
            },
            {
                "id": "cms",
                "name": "CMS Medicare Provider Data",
                "description": "Medicare claims data by NPI and HCPCS code. Filter by 97151-97158 for ABA therapy.",
                "source": "Centers for Medicare & Medicaid Services",
                "url": "https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service",
                "reliability": "10/10",
                "has_data": False,
                "files": ["cms_dataset.json"],
                "download_required": True,
            },
            {
                "id": "tmsis",
                "name": "T-MSIS Analytic Files (Medicaid Claims)",
                "description": "Gold standard Medicaid claims data. Contains all ABA claims across all states. Requires DUA application.",
                "source": "CMS via ResDAC",
                "url": "https://resdac.org/",
                "reliability": "10/10",
                "has_data": False,
                "files": ["tmsis_dataset.json"],
                "download_required": True,
            },
        ]
    }

    with open(f"{OUTPUT_DIR}/datasets_index.json", "w") as f:
        json.dump(datasets_index, f, indent=2)

    print("\n" + "=" * 60)
    print("Done! Dataset files saved to public/data/")
    print("=" * 60)
