Mint2Metal
Technical & Operational Brief
SecƟon I — Technical Architecture
SecƟon II — Detailed Technical DescripƟon of the Project
Project DefiniƟon
Mint2Metal is an operaƟons-first Real World Asset plaƞorm designed to
tokenize physically backed silver while maintaining strict guarantees around
custody, auditability, and issuance discipline.
The plaƞorm intenƟonally avoids DeFi-first or instant-mint architectures.
Instead, it prioriƟzes operaƟonal correctness, compliance readiness, and
verifiable asset backing.
OperaƟonal Flow — InternaƟonal Users
 Web3 authenƟcaƟon
 DST trading only
 No physical redempƟon
 KYC applied only where jurisdicƟonally required
OperaƟonal Flow — Indian Users
Core Architectural Commitment
No token is minted unless corresponding physical silver is acquired, verified,
and securely stored.
This commitment is enforced both:
 OperaƟonally (batching + confirmaƟons)
 Technically (restricted Soroban mint logic)
SecƟon III — Core Support Requested from Stellar India
(Beyond IncenƟves)
We are not seeking promoƟonal or markeƟng assistance.
We seek technical validaƟon, architectural guidance, and product-level
mentorship.
Requested Support Areas
1. Soroban Architecture Review
 Controlled mint/burn paƩerns
 Admin key management strategies
 Contract upgrade and versioning paths
2. Asset vs Contract Design Guidance
 EvaluaƟon of:
o Stellar Classic Asset issuance
o Soroban contract-based token control
 RecommendaƟons aligned with long-term RWA scalability
3. Ops-First RWA Best PracƟces
 Structuring off-chain operaƟonal workflows
 Linking custody confirmaƟons to on-chain proofs
 Failure and reconciliaƟon handling paƩerns
4. Priority Technical Mentorship
 Feedback on MVP scope
 ValidaƟon of architectural assumpƟons
 Guidance on features to explicitly exclude at this stage
SecƟon IV — ObjecƟves for the 5-Day Residency
Residency Deliverables
By the conclusion of the residency, we aim to achieve the following:
1. Architecture FinalizaƟon
 Clear definiƟon of on-chain vs off-chain responsibiliƟes
 Confirmed token issuance and custody boundaries
2. MVP ImplementaƟon
 End-to-end flow:
o Buy → batch → mint → balance visibility
3. Stellar Testnet Deployment
 Deployment of DST with controlled mint and burn logic
4. OperaƟonal Playbook
 MinƟng rules
 RedempƟon rules
 Failure and excepƟon handling procedures
5. Structured Feedback
 Technical feasibility assessment
 Risk idenƟficaƟon
 DirecƟon for a focused 90-day roadmap 