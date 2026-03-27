# CLAUDE.md - ABA Therapy Fraud Detection

## Project Overview
This repository contains a fraud detection system for ABA (Applied Behavior Analysis) therapy providers, using synthetic data modeled on real-world patterns from government audits and enforcement actions.

## Key Learnings

### Dataset Learnings
1. **No public ABA-specific fraud dataset exists.** ABA therapy is primarily Medicaid-funded (children with autism), while most public fraud datasets are Medicare-focused. We had to generate synthetic data.
2. **Kaggle Medicare fraud dataset (rohitrox)** has ~9.35% fraud rate with 5,410 providers. We matched this distribution.
3. **CMS Medicare Physician & Other Practitioners data** is the closest real data source - it contains HCPCS code 97153 (ABA direct therapy) breakdowns by NPI. However it's Medicare-only and most ABA is Medicaid.
4. **LEIE exclusion list** provides ground-truth fraud labels but with significant lag - providers are only added after conviction/exclusion.
5. **ABA billing**: 97153 (direct therapy by RBT) dominates at ~50% of all ABA claims. Typical rates $19-$50 per 15-minute unit depending on code and provider level.

### Modeling Learnings
1. **Synthetic data leakage is a major risk.** Initially, network features (clustering coefficient, weighted degree) perfectly separated fraud from non-fraud because the synthetic network was built with fraud ring structure. Had to add noise, legitimate provider clusters, and cross-connections.
2. **Excluding network-structural features from supervised models** was necessary. We use network features (PageRank, community detection) separately for network analysis visualization, not as ML model inputs.
3. **Realistic AUC is 0.83-0.86** for this problem. Literature reports healthcare fraud detection AUCs of 0.80-0.95. Our initial 1.0 AUC was a clear sign of data leakage.
4. **Feature importance** shows billing patterns (avg_billed, code ratios) and temporal features (weekend ratio, school hours) are most predictive - this aligns with OIG audit findings.
5. **Isolation Forest** (unsupervised) achieves 0.826 AUC without any labels - valuable for detecting novel fraud patterns.
6. **Benford's Law analysis** is a useful feature but not among the top predictors for this synthetic dataset. May be more important with real billing amounts.

### Technical Learnings
1. **Next.js 16 with Tailwind v4**: Use `@tailwindcss/postcss` plugin in postcss.config.mjs, not the older `tailwindcss` plugin.
2. **Recharts TypeScript**: The `formatter` prop on `Tooltip` requires handling `ValueType | undefined`, not just `number`. Use `(v) => Number(v).toFixed(4)` pattern.
3. **NumPy JSON serialization**: `json.dump()` cannot serialize numpy float32/int64 types. Use a custom `NumpyEncoder` class that converts numpy types to Python natives.
4. **Static export for Vercel**: Set `output: "export"` in `next.config.ts` and `images: { unoptimized: true }` for static deployment.
   - `rootDirectory` is a **Vercel dashboard setting only** - it is NOT valid in `vercel.json` and will cause schema validation failure.
   - For monorepo setups, use `cd website &&` prefix in `buildCommand` and `installCommand` instead.
   - When using `framework: "nextjs"`, Vercel expects `.next/routes-manifest.json` - do NOT use `output: "export"` with static `out/` directory. Remove `output: "export"` from next.config.ts and set `outputDirectory` to `website/.next`.
   - Root `package.json` must list `next` in dependencies for Vercel framework detection, even if the actual app is in a subdirectory.
5. **create-next-app interactive mode**: The CLI prompts cannot be answered in non-interactive environments. Initialize manually with `npm init` + install dependencies.

### Fraud Pattern Learnings (from HHS-OIG audits)
1. **Indiana**: $56M improper ABA payments. ABA Medicaid spending grew from $14.4M (2017) to $101.8M (2020) - 607% increase.
2. **Colorado**: $77.8M improper + $207.4M potentially improper. All 100 sampled enrollee-months had issues.
3. **Wisconsin**: $18.5M improper. 100% of sampled months had problems.
4. **Massachusetts**: Supervision ratio violations (>10:1 RBT to BCBA ratio) cost $16.7M.
5. **Common patterns**: Missing/fabricated documentation, unlicensed staff, no proper supervision, billing during school hours, phantom services.
6. **ABA volume increased 267% from 2019-2024** (Behavioral Health Business), creating more opportunity for fraud.

### Network Analysis Learnings
1. **Louvain community detection** effectively identifies clusters of connected providers. Fraud rings form dense subgraphs.
2. **PageRank** identifies central nodes that may be coordinating fraud across a network.
3. **Community fraud rate > 30% with 3+ members** is a reasonable threshold for flagging suspicious communities.
4. **Real fraud detection should combine** network analysis with billing pattern analysis - neither alone is sufficient.
5. **GNN+Neo4j systems** can reach 91% accuracy and AUC of 0.961 for coordinated fraud rings (Tsega et al., 2025).
6. **Oskarsdottir et al. (2022)** showed network-derived features outperform classical claim-specific features alone.

### Methodology Research Findings (Literature Review)
1. **Algorithm rankings** from systematic reviews (du Preez et al. 2025, 145+ applications):
   - Random Forest: AUC 0.90-0.97 (consistently top performer)
   - XGBoost: AUC 0.90-0.95 (best with SMOTE-ENN resampling)
   - Isolation Forest: ~0.81 recall standalone (unsupervised)
   - GNNs: AUC 0.91-0.96 on heterogeneous graphs
2. **Class imbalance**: Fraud can be as low as 0.03% in Medicare datasets. SMOTE-ENN with XGBoost achieved AUC 0.95.
3. **Unsupervised vs supervised**: Unsupervised max AUC ~0.729 vs supervised 0.969 on same Medicare data. But unsupervised is essential for novel pattern discovery.
4. **Optimal layered approach**: Rule-based screening -> Supervised ML -> Unsupervised anomaly detection -> Graph analytics
5. **Benford's Law**: Useful as first-line screening before ML. Applied to Korean HIRA data for large-scale screening.
6. **Explainability is critical**: SHAP/LIME needed for regulatory acceptance (CMS CRUSH Initiative context).
7. **Total OIG ABA audit findings across states**: ~$418M+ in improper/potentially improper payments (IN $56M + CO $285M + ME $45.6M + WI $18.5M + MA $16.7M).

## Running the Pipeline

```bash
# Generate data
python3 scripts/generate_aba_dataset.py

# Run analysis (generates website data)
python3 scripts/fraud_analysis.py

# Run website
cd website && npm install && npm run dev
```

## Dependencies
- Python: pandas, numpy, scikit-learn, xgboost, networkx, matplotlib, seaborn
- Node.js: next, react, recharts, tailwindcss, typescript

## Real-World ABA Fraud Cases (Reference for Pattern Validation)
1. **Smart Therapy LLC (MN)**: $14M+ Medicaid fraud. Billed max authorized EIDBI hours for services not rendered. Paid kickbacks ($1,000+/child) to Somali families. EIDBI providers grew 700% (41 to 300+) in 5 years in MN.
2. **Minds Cornerstone (CT)**: $1.88M. Operator ran company under pseudonym while incarcerated. Billed ABA supervision without technician services.
3. **Lamour by Design (MA)**: $1M+. Sole LABA was part-time and denied performing billed services. Staff instructed to bill "based on historical data."
4. **National Medicaid ABA spending**: $660M (2019) to $2.2B (2023). Indiana alone: $14.4M (2017) to $611M (2023).

## Key ABA CPT Codes Reference
| Code | Description | Typical Biller | Our Rate/Unit |
|------|-------------|---------------|---------------|
| 97151 | Behavior identification assessment | BCBA | $50 |
| 97152 | Supporting assessment | Technician | $32 |
| 97153 | Adaptive behavior treatment by protocol | RBT | $19 |
| 97154 | Group treatment by protocol | RBT | $11.50 |
| 97155 | Treatment with protocol modification | BCBA | $38 |
| 97156 | Family treatment guidance | BCBA | $36 |
| 97157 | Multiple-family group treatment | BCBA | $16 |
| 97158 | Group treatment with modification | BCBA | $22 |

## T-MSIS Access Process (Gold Standard Data)
- **Contact**: ResDAC at resdac@umn.edu or 888-973-7322
- **Cost**: $20,000 initial project fee + $10,000/yr renewal + VRDC seat fees
- **Timeline**: 3-5 months from application to data access
- **Requirements**: DUA, IRB approval, HIPAA waiver, CMS Privacy Board review
- **Data years**: 2014-2023 available (2024 after 11/1/2026)
- **Key files for ABA**: TAF Other Services (OT) for claims, TAF DE for demographics, TAF PR for providers
- **All research must use VRDC** (Virtual Research Data Center) starting 2025

## For Real-World Implementation
- **Best data source**: T-MSIS Analytic Files (Medicaid claims) - requires ResDAC DUA
- **Fraud labels**: Cross-reference LEIE exclusion list filtered by taxonomy 103K00000X (Behavioral Analyst)
- **Provider universe**: NPPES NPI file filtered by taxonomy 103K00000X and 106E00000X
- The dataset is SYNTHETIC - not suitable for real fraud investigations
- Model performance reflects synthetic data characteristics, not real-world performance
- The CMS CRUSH Initiative (Feb 2026) signals major federal investment in AI-based fraud detection
