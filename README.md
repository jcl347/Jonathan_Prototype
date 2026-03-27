# ABA Therapy Fraud Detection System

Multi-model fraud detection pipeline for Applied Behavior Analysis (ABA) therapy providers using network analytics, ensemble machine learning, and anomaly detection.

## Project Structure

```
├── scripts/
│   ├── generate_aba_dataset.py   # Synthetic data generation
│   └── fraud_analysis.py         # ML pipeline + network analysis
├── data/
│   └── generated/                # Generated datasets (CSV + JSON)
├── website/                      # Next.js dashboard (Vercel-ready)
│   ├── app/
│   │   ├── page.tsx              # Main dashboard
│   │   ├── providers/page.tsx    # Individual provider analysis
│   │   ├── network/page.tsx      # Network/community analysis
│   │   └── models/page.tsx       # Model performance comparison
│   └── public/data/              # JSON data for visualizations
├── CLAUDE.md                     # Learnings and development notes
└── README.md
```

## Quick Start

```bash
# 1. Generate synthetic dataset
python3 scripts/generate_aba_dataset.py

# 2. Run fraud analysis pipeline
python3 scripts/fraud_analysis.py

# 3. Run the website
cd website && npm install && npm run dev
```

## Methodology

### Approach: Multi-Model Ensemble + Network Analytics

Our approach combines three complementary strategies:

1. **Supervised Learning** (XGBoost, Random Forest) - Trained on labeled provider data with 36+ engineered features
2. **Unsupervised Anomaly Detection** (Isolation Forest) - Identifies statistical outliers without labels
3. **Network Analytics** (Louvain Community Detection, PageRank) - Discovers fraud rings and collusion networks

### Feature Engineering (36+ features)

| Category | Features | Fraud Signal |
|----------|----------|-------------|
| **Billing Patterns** | HCPCS code distribution, high-reimb ratio, billed/allowed ratio | Upcoding, phantom billing |
| **Volume Metrics** | Claims count, total billed, claims/patient ratio | Excessive billing |
| **Temporal** | Weekend billing ratio, school-hours ratio, billing entropy | Impossible schedules |
| **Statistical** | Benford's Law deviation, billing std dev | Fabricated amounts |
| **Geographic** | State mismatch ratio, unique patient states | Geographic impossibility |
| **Network** | PageRank, clustering coeff, community detection | Fraud rings |

### Model Performance (5-Fold Cross-Validated)

| Model | AUC | Notes |
|-------|-----|-------|
| Random Forest | 0.860 | Balanced class weights |
| XGBoost | 0.838 | Scale pos weight for imbalance |
| Isolation Forest | 0.826 | Unsupervised (no labels needed) |
| **Ensemble** | **Best** | Weighted combination of all three |

---

## Researched Datasets: Reliability Rankings

### Tier 1: Government/Official Sources (Highest Reliability)

#### 1. CMS Medicare Physician & Other Practitioners Dataset
- **Source**: [data.cms.gov](https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service)
- **Reliability: 10/10**
- **Why reliable**: Official CMS government data. Contains actual Medicare claims aggregated by NPI and HCPCS code. Includes provider-level utilization, payment amounts, and submitted charges. Updated annually.
- **Relevance to ABA**: Can filter by HCPCS codes 97151-97158 (ABA therapy codes). Shows which providers bill ABA codes, how much they bill, and to how many beneficiaries.
- **Limitations**: Medicare-only (most ABA is Medicaid-funded since patients are typically children). Aggregated data - no individual claim records.

#### 2. HHS-OIG LEIE (List of Excluded Individuals/Entities)
- **Source**: [oig.hhs.gov/exclusions/exclusions_list.asp](https://oig.hhs.gov/exclusions/exclusions_list.asp)
- **Reliability: 10/10**
- **Why reliable**: Official government exclusion list maintained by HHS Office of Inspector General. Contains providers convicted of fraud or excluded from federal healthcare programs. Includes NPI, exclusion reason, and dates.
- **Relevance to ABA**: Can cross-reference ABA provider NPIs against this list to identify known fraudsters. Provides ground-truth labels for supervised learning.
- **Limitations**: Only includes providers who were caught and formally excluded. Many fraudulent providers are never caught.

#### 3. NPPES NPI Registry
- **Source**: [download.cms.gov/nppes/NPI_Files.html](https://download.cms.gov/nppes/NPI_Files.html)
- **Reliability: 10/10**
- **Why reliable**: Official CMS provider registry. Every healthcare provider billing federal programs must have an NPI. Contains provider demographics, specialties, practice locations.
- **Relevance to ABA**: Cross-reference provider credentials, locations, and organizational affiliations for network analysis.
- **Limitations**: 9.3 GB file size. Contains all providers, not just ABA. No fraud labels.

#### 4. HHS-OIG State Audit Reports (Indiana, Colorado, Wisconsin, Massachusetts)
- **Source**: [oig.hhs.gov/reports](https://oig.hhs.gov/reports/all/2024/indiana-made-at-least-56-million-in-improper-fee-for-service-medicaid-payments-for-applied-behavior-analysis-provided-to-children-diagnosed-with-autism/)
- **Reliability: 10/10**
- **Why reliable**: Official federal audit findings with specific dollar amounts and sampling methodology. Findings led to recommended refunds to federal government.
- **Key findings used in our model**:
  - Indiana: $56M in improper ABA payments (Dec 2024)
  - Colorado: $77.8M improper + $207.4M potentially improper (2025-2026)
  - Maine: $45.6M in improper payments ([OIG](https://oig.hhs.gov/newsroom/news-releases-articles/hhs-oig-audit-finds-maine-made-at-least-456-million-in-improper-medicaid-payments-for-autism-services/))
  - Wisconsin: $18.5M confirmed + $94.3M potential (Jul 2025) ([OIG](https://oig.hhs.gov/reports/all/2025/wisconsin-made-at-least-185-million-in-improper-fee-for-service-medicaid-payments-for-applied-behavior-analysis-provided-to-children-diagnosed-with-autism/))
  - Massachusetts: $16.7M overpayments from supervision ratio violations (2024)
- **Limitations**: Aggregated findings, not individual claim-level data.

#### 5. T-MSIS Analytic Files (Medicaid Claims -- Restricted Access)
- **Source**: [medicaid.gov/T-MSIS](https://www.medicaid.gov/medicaid/data-systems/macbis/medicaid-chip-research-files/transformed-medicaid-statistical-information-system-t-msis-analytic-files-taf)
- **Reliability: 10/10**
- **Why reliable**: THE GOLD STANDARD for ABA fraud research. Most comprehensive Medicaid claims dataset - enrollment, demographics, service utilization, and payments for all Medicaid/CHIP beneficiaries across all states. Likely the data HHS-OIG used for their state audit series.
- **Relevance to ABA**: Contains all ABA claims (97151-97158, T1024, etc.) across all states. Since ABA is predominantly Medicaid-funded (children/autism), this is the primary data source.
- **Limitations**: **Not freely downloadable.** Requires application through ResDAC and a CMS Data Use Agreement. Restricted to approved researchers.

### Tier 2: Academic/Curated Datasets (High Reliability)

#### 6. Kaggle Healthcare Provider Fraud Detection Dataset
- **Source**: [kaggle.com/datasets/rohitrox/healthcare-provider-fraud-detection-analysis](https://www.kaggle.com/datasets/rohitrox/healthcare-provider-fraud-detection-analysis)
- **Also on Mendeley**: [data.mendeley.com/datasets/gsn2hyty37/1](https://data.mendeley.com/datasets/gsn2hyty37/1)
- **Reliability: 7/10**
- **Why somewhat reliable**: Based on Medicare claims data structure with realistic features (beneficiary demographics, diagnosis codes, physician IDs, claim amounts). 5,410 providers with 9.35% fraud rate. 4 CSV files: Beneficiary, Inpatient, Outpatient, and Provider fraud labels. Widely used in academic research and ML competitions.
- **Why not fully reliable**: The fraud labels are synthetic/derived - the dataset creator determined fraud labels based on patterns, not confirmed investigations. The underlying data may be a realistic simulation rather than actual Medicare data. No direct link to DOJ/OIG fraud convictions.
- **Relevance to ABA**: General healthcare fraud patterns. Used to validate our synthetic data's statistical properties (class imbalance ratio, feature distributions).
- **Our validation**: Our synthetic dataset matches this dataset's fraud rate (~9.5%) and feature distribution patterns.

#### 7. Kaggle NHIS Healthcare Claims and Fraud Dataset
- **Source**: [kaggle.com/datasets/bonifacechosen/nhis-healthcare-claims-and-fraud-dataset](https://www.kaggle.com/datasets/bonifacechosen/nhis-healthcare-claims-and-fraud-dataset)
- **Reliability: 6/10**
- **Why somewhat reliable**: Another labeled fraud detection dataset with claims-level data. Freely downloadable on Kaggle.
- **Why not fully reliable**: Less widely cited than the rohitrox dataset. Provenance and label generation methodology less documented.
- **Relevance to ABA**: Provides an alternative labeled dataset for developing and benchmarking fraud detection methodologies.

#### 8. Journal of Big Data - Medicare Fraud Detection Dataset
- **Source**: [journalofbigdata.springeropen.com](https://journalofbigdata.springeropen.com/articles/10.1186/s40537-023-00821-5)
- **Reliability: 8/10**
- **Why reliable**: Peer-reviewed research using publicly available Medicare claims data combined with LEIE exclusion data for ground-truth labels. Reproducible methodology.
- **Relevance to ABA**: Demonstrates the approach of combining CMS claims data with LEIE for fraud labeling, which is the gold standard for healthcare fraud datasets.

### Tier 3: Industry/News Sources (Moderate Reliability)

#### 7. DOJ Press Releases and Enforcement Actions
- **Source**: [justice.gov](https://www.justice.gov)
- **Reliability: 8/10 (for cases mentioned), 6/10 (for generalizing patterns)**
- **Why reliable**: Confirmed fraud cases with conviction details. June 2025 DOJ healthcare fraud takedown: $14.6B in fraudulent claims, 324 defendants.
- **Relevance to ABA**: Multiple confirmed ABA-specific fraud cases:
  - **Smart Therapy LLC (MN)**: $14M+ Medicaid fraud, billed max authorized hours for services not rendered, paid kickbacks to families. Guilty plea. ([IRS](https://www.irs.gov/compliance/criminal-investigation/first-defendant-charged-in-autism-fraud-scheme))
  - **Minds Cornerstone (CT)**: $1.88M fraud, billing ABA supervision without services. 78 months prison. ([DOJ](https://www.justice.gov/usao-ct/pr/two-charged-defrauding-connecticuts-medicaid-program))
  - **Lamour by Design (MA)**: $1M+ false claims, employees instructed to bill "based on historical data." Indicted Jun 2025. ([Mass.gov](https://www.mass.gov/news/ags-office-secures-indictments-against-randolph-autism-service-provider-for-allegedly-submitting-more-than-1-million-in-false-claims))
- **Limitations**: Selection bias - only includes cases that were prosecuted. Does not represent the full spectrum of fraud.

#### 10. CMS CRUSH Initiative Data
- **Source**: [cms.gov/newsroom](https://www.cms.gov/newsroom/press-releases/trump-administration-prioritizes-affordability-announcing-major-crackdown-health-care-fraud)
- **Reliability: 7/10**
- **Why reliable**: Official CMS figures: suspended $5.7B in suspected fraudulent Medicare payments in 2025, denied 122,658 claims, revoked 5,586 providers.
- **Limitations**: Aggregate statistics, no downloadable dataset. AI detection methodology not publicly disclosed.

### Tier 4: Our Synthetic Dataset (Validated Simulation)

#### 11. This Project's Synthetic ABA Fraud Dataset
- **Reliability: 6/10** (as a training tool) / **3/10** (as real-world evidence)
- **Why we built it**: No public dataset exists specifically for ABA therapy fraud detection. ABA therapy is primarily Medicaid-funded (children/autism), while most public fraud datasets are Medicare-focused.
- **Validation against real data**:
  - Fraud rate (9.5%) matches Kaggle Medicare dataset (9.35%) and OIG estimates (3-10%)
  - HCPCS code distribution matches real ABA billing (97153 dominant at ~50% of claims)
  - Reimbursement rates based on actual Medicaid fee schedules ($19-$50/unit for 15-min units)
  - Fraud patterns modeled on specific OIG audit findings (upcoding, excessive hours, documentation fraud)
  - Patient demographics match ASD epidemiology (4:1 male ratio, ages 2-21)
  - AUC performance (0.83-0.86) falls within realistic range per literature review
- **Limitations**: Synthetic data cannot capture the full complexity of real billing patterns. Fraud patterns may be more detectable than in reality. Network structure is simplified.

---

## Fraud Patterns Modeled

Based on HHS-OIG audit findings and DOJ enforcement actions:

| Pattern | Description | Source |
|---------|-------------|--------|
| **Upcoding** | Billing 97155 (BCBA supervision, $38/unit) when 97153 (RBT direct, $19/unit) was provided | OIG Indiana Audit |
| **Excessive Hours** | >40 hrs/week per patient when 25-40 is maximum recommended | OIG Colorado Audit |
| **Phantom Billing** | Claims for services never rendered | MA AG Indictment (Jun 2025) |
| **Credential Fraud** | RBTs billing under BCBA codes without supervision | OIG Wisconsin Audit |
| **School Hours** | Billing for school-age children during school hours (Mon-Fri 8am-3pm) | Industry whistleblower reports |
| **Weekend Anomaly** | Excessive weekend/holiday billing | Statistical anomaly indicator |
| **Network Fraud** | Coordinated billing rings across linked providers | DOJ June 2025 takedown |

## Technology Stack

- **Data Science**: Python, pandas, scikit-learn, XGBoost, NetworkX
- **Website**: Next.js 16, TypeScript, Tailwind CSS, Recharts
- **Deployment**: Vercel (static export)
- **Network Analysis**: Louvain community detection, PageRank centrality

## References

1. Bauder & Khoshgoftaar (2017). "Medicare fraud detection using neural networks." *Journal of Big Data*.
2. Joudaki et al. (2015). "Using data mining to detect health care fraud and abuse: A review of literature."
3. HHS-OIG Indiana ABA Audit (Dec 2024). [Link](https://oig.hhs.gov/reports/all/2024/indiana-made-at-least-56-million-in-improper-fee-for-service-medicaid-payments-for-applied-behavior-analysis-provided-to-children-diagnosed-with-autism/)
4. Morgan Lewis (Nov 2025). "Applied Behavioral Analysis: Key Service Under Payment Scrutiny." [Link](https://www.morganlewis.com/blogs/healthlawscan/2025/11/applied-behavioral-analysis-key-service-for-children-with-autism-is-under-payment-scrutiny)
5. CMS CRUSH Initiative (Feb 2026). [Link](https://www.cms.gov/newsroom/press-releases/trump-administration-prioritizes-affordability-announcing-major-crackdown-health-care-fraud)
6. PMC: GNN Fraud Detection in Medical Claims (2025). [Link](https://pmc.ncbi.nlm.nih.gov/articles/PMC12647751/)
7. Kaggle Healthcare Provider Fraud Detection. [Link](https://www.kaggle.com/datasets/rohitrox/healthcare-provider-fraud-detection-analysis)
8. CMS Medicare Provider Data. [Link](https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners)
9. HHS-OIG LEIE. [Link](https://oig.hhs.gov/exclusions/exclusions_list.asp)
10. Behavioral Health Business: ABA Volume +267% (Dec 2025). [Link](https://bhbusiness.com/2025/12/22/aba-volume-skyrocketed-by-267-from-2019-to-2024/)
11. du Preez et al. (2025). "Fraud detection in healthcare claims using ML: A systematic review." *Artificial Intelligence in Medicine*. [Link](https://www.sciencedirect.com/science/article/pii/S0933365724003038)
12. Herland et al. (2023). "Explainable ML models for Medicare fraud detection." *Journal of Big Data*. [Link](https://journalofbigdata.springeropen.com/articles/10.1186/s40537-023-00821-5)
13. Oskarsdottir et al. (2022). "Social Network Analytics for Supervised Fraud Detection in Insurance." *Risk Analysis*. [Link](https://onlinelibrary.wiley.com/doi/10.1111/risa.13693)
14. Tsega et al. (2025). "Fraud detection in medical claims using GNN architectures." *Scientific Reports*. [Link](https://www.nature.com/articles/s41598-025-22910-6)
15. OIG Maine ABA Audit. [Link](https://oig.hhs.gov/newsroom/news-releases-articles/hhs-oig-audit-finds-maine-made-at-least-456-million-in-improper-medicaid-payments-for-autism-services/)
16. OIG Wisconsin ABA Audit. [Link](https://oig.hhs.gov/reports/all/2025/wisconsin-made-at-least-185-million-in-improper-fee-for-service-medicaid-payments-for-applied-behavior-analysis-provided-to-children-diagnosed-with-autism/)
