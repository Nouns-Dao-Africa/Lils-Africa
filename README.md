# NDA ↔ LilNouns Governance Bridge

## Complete Project Scope & Implementation Plan

### 🎯 Project Overview
**NDA ↔ LilNouns Governance Bridge**

A GitHub-Actions-driven pipeline enabling NounsDaoAfrica (NDA) ERC‑721 holders to:

- Mirror on-chain LilNouns DAO proposals into Snapshot
- Relay community votes back on‑chain via Gnosis Safe
- Forward community‑created "LilProps" for off‑chain Approve/Reject voting
- Submit approved LilProps on‑chain to the LilNouns Governor

**How It Works**
- All scripts run every minute via GitHub Actions
- Uses encrypted secrets for private keys
- Automated proposal mirroring and vote execution
- JSON state tracking for processed proposals
- Gnosis Safe integration for secure on-chain voting

---

### 📦 Repository Structure
```plaintext
nda-lilnouns-relay/
├── mirror.js                  # Detect & mirror on-chain proposals → Snapshot
├── relay.js                   # Tally Snapshot votes → castVote on-chain
├── prop_forward.js            # Forward community LilProps → main vote space
├── prop_submit.js             # Submit approved LilProps on-chain
├── prop_forward_state.json    # Tracks forwarded prop IDs (auto-generated)
├── prop_submit_state.json     # Tracks submitted prop IDs (auto-generated)
├── package.json               # npm scripts & dependencies
├── .env.example               # Sample environment variables
└── .github/workflows/
    ├── mirror.yml             # Schedule for mirror.js
    ├── relay.yml              # Schedule for relay.js
    ├── prop_forward.yml       # Schedule for prop_forward.js
    └── prop_submit.yml        # Schedule for prop_submit.yml
```

---

### 🔧 Core Services

#### mirror.js
**Function:** Listens for ProposalCreated events on LilNouns Governor

**Process:**
- Scans blockchain for new proposals
- Creates matching off‑chain proposals in Snapshot (nda-league-of-lils)
- Ensures community sees every new proposal instantly

**Schedule:** Runs every minute

#### relay.js
**Function:** Executes community votes on-chain

**Process:**
- Queries Snapshot for closed proposals in nda-league-of-lils
- Verifies on‑chain votingEnd timestamp
- Submits Gnosis Safe vote via castVote function

**Schedule:** Runs every 5 minutes

#### prop_forward.js
**Function:** Routes community proposals to voting

**Process:**
- Polls community space lils-africa-props for new proposals
- Forwards as single-choice vote (Approve/Reject) to lils-africa
- Tracks forwarded proposals in state file

**Schedule:** Runs every minute

#### prop_submit.js
**Function:** Submits approved community proposals on-chain

**Process:**
- Tallies closed votes in lils-africa space
- If "Approve" ≥ threshold (50%), parses JSON for parameters
- Calls Governor.propose() on LilNouns Governor

**Schedule:** Runs every minute

---

### ⚙️ Configuration Variables & Addresses

| File            | Variable             | Description                                      |
|-----------------|----------------------|--------------------------------------------------|
| mirror.js       | LIL_NOUNS_GOVERNOR   | Governor contract address (Ethereum Mainnet)     |
| mirror.js       | SNAPSHOT_SPACE       | Snapshot space ID (nda-league-of-lils)           |
| mirror.js       | NDA_ERC721_ADDRESS   | NDA ERC‑721 contract address (Base)              |
| mirror.js       | BLOCK_RANGE          | Blocks back to scan for proposals                |
| mirror.js       | RELAY_KEY (env)      | Private key for mirror.js (must hold ETH)        |
| relay.js        | LIL_NOUNS_GOVERNOR   | Same as above                                    |
| relay.js        | GNOSIS_SAFE_ADDRESS  | Safe address holding LilNouns tokens             |
| relay.js        | ETH_RPC              | Ethereum RPC endpoint URL                        |
| relay.js        | SAFE_OWNER_KEY (env) | Private key for relay.js                         |
| prop_forward.js | SOURCE_SPACE         | Community space (lils-africa-props)              |
| prop_forward.js | TARGET_SPACE         | Main vote space (lils-africa)                    |
| prop_forward.js | NDA_ERC721_ADDRESS   | NDA ERC‑721 contract (Base)                      |
| prop_forward.js | RELAY_KEY (env)      | Private key for forwarding                       |
| prop_submit.js  | GOVERNOR_ADDRESS     | Governor contract address                        |
| prop_submit.js  | TARGET_SPACE         | Main vote space (lils-africa)                    |
| prop_submit.js  | PASS_THRESHOLD       | Approval ratio (e.g. 0.5 = 50%)                  |
| prop_submit.js  | SAFE_OWNER_KEY (env) | Private key for submission                        |

**Important:** Add both state JSON files to `.gitignore` so they don't get committed.

---

### 🔐 Key Management

#### Snapshot Relay Private Key (RELAY_KEY)
**Purpose:** Signs off-chain "proposal creation" calls to Snapshot

**Setup:**
- Generate fresh Ethereum account (MetaMask, ethers.Wallet.createRandom())
- Fund with small ETH amount (~few cents for 1-2 gwei gas)
- Store securely in GitHub Secrets or vault service
- Export as RELAY_KEY environment variable

#### Gnosis Safe Signer Key (SAFE_OWNER_KEY)
**Purpose:** One of the Safe owners controlling LilNouns token pool

**Setup:**
- Create new EOA for each multisig member
- Add addresses as Safe owners (2-of-3 or 4-of-7 threshold)
- Distribute keys to trusted individuals with hardware wallets
- Store one key as SAFE_OWNER_KEY for automation

**Security Best Practices:**
- Never commit private keys to source control
- Use GitHub Secrets for CI/CD key storage
- Rotate keys periodically
- Audit multisig owners regularly

---

### 📋 Next Steps

1. **Create Snapshot Spaces**
   - Community: lils-africa-props (allow NDA NFT holders to propose)
   - Main: lils-africa (locked to bot-driven forwarding)
   - Mirror: nda-league-of-lils (mirror of official proposals)
2. **Configure Strategies**
   - Use nft-balance-of with NDA ERC‑721 contract on Base (chainId 8453)
   - Set appropriate voting periods and quorum requirements
3. **Add GitHub Secrets**
   - RELAY_KEY = Snapshot relayer private key
   - SAFE_OWNER_KEY = Ethereum multisig signer key
4. **Deploy & Test**
   - Commit all scripts and workflows to main branch
   - Verify workflows run without errors in Actions tab
   - Create dummy LilProp and test end-to-end flow
5. **Monitor & Maintain**
   - Check "Mirror Proposals" runs every minute
   - Verify "Relay Votes" runs every 5 minutes
   - Review logs for errors or rate-limit warnings

---

## 🛠️ Step-by-Step Implementation Plan

### Phase 1: Foundation Setup (Days 1-2)
**Day 1: Repository and Environment**
- Create GitHub repository with branch protection
- Set up development, staging, and production environments
- Configure GitHub Secrets for all API keys
- Initialize npm project with dependencies
- Create Docker containers for local development

**Day 2: Blockchain Connections & Snapshot**
- Set up Ethereum mainnet RPC endpoints (Alchemy + Infura failover)
- Configure Base chain RPC for NDA token queries
- Deploy test Gnosis Safe on Ethereum mainnet
- Verify contract ABIs for Governor and Token contracts
- Test basic read operations on both chains
- Create three Snapshot spaces with proper settings
- Configure voting strategies for NFT balance checking
- Set up webhook notifications for proposal events

### Phase 2: Core Services Development (Days 3-6)
**Day 3: Mirror Service**
- Implement blockchain event listener for ProposalCreated
- Build proposal data transformer (chain → Snapshot format)
- Create state management for processed proposals
- Add retry logic with exponential backoff
- Deploy to GitHub Actions with 1-minute schedule

**Day 4: Relay Service**
- Build Snapshot GraphQL query for closed proposals
- Implement vote aggregation logic
- Integrate Gnosis Safe SDK for transaction building
- Add signature collection from Safe owners
- Test end-to-end vote execution on testnet

**Day 5: Proposal Forward Service**
- Create proposal validation schema
- Build forwarding logic with deduplication
- Implement approval voting template
- Add notification system for new proposals
- Test with various proposal formats

**Day 6: Proposal Submit Service**
- Parse proposal JSON for on-chain parameters
- Build Governor.propose() transaction encoder
- Implement threshold checking (>50% approval)
- Add gas estimation and optimization
- Complete integration testing

### Phase 3: Frontend Development (Days 7-9)
**Day 7: Frontend Architecture**
- Set up Next.js 14 with TypeScript
- Configure Tailwind CSS and component library
- Implement Web3 wallet connection (Rainbow Kit)
- Create Redux store for state management
- Set up API routes for backend communication

**Day 8: Core User Interface**
- Build proposal list with filtering and search
- Create detailed proposal view with voting UI
- Implement vote confirmation flow with signatures
- Add transaction status tracking
- Create user profile with vote history

**Day 9: Proposal Creation & Admin Dashboard**
- Design multi-step proposal form
- Add rich text editor for descriptions
- Implement action builder for on-chain calls
- Build system monitoring dashboard
- Create Safe management interface
- Add emergency controls panel

### Phase 4: Smart Contract Development (Days 10-12)
**Day 10: Governance Agent Contract**
- Write core contract with proxy pattern
- Implement cross-chain message handling
- Add access control and pausability
- Create comprehensive test suite
- Deploy to testnet for integration testing

**Day 11: Safe Module Integration**
- Develop custom Safe module contract
- Integrate Reality.eth oracle
- Implement SafeSnap compatibility
- Add transaction guards
- Test with live Safe instance

**Day 12: Cross-chain Infrastructure & Testing**
- Configure LayerZero OApp or Hyperlane Router
- Set up message verification (DVN/ISM)
- Run automated security scanners
- Test edge cases and attack vectors

### Phase 5: Integration & Testing (Days 13-14)
**Day 13: End-to-End Testing**
- Create test proposal on LilNouns testnet
- Verify mirror to Snapshot space
- Test voting from multiple accounts
- Confirm on-chain execution
- Validate state consistency

**Day 14: Load & Security Testing**
- Simulate 100+ concurrent voters
- Test with gas price spikes
- Smart contract fuzzing
- Key rotation procedures
- Beta test with NDA holders
- Fix identified issues
- Prepare launch materials

### Phase 6: Deployment & Launch (Day 15)
**Day 15: Production Deployment & Launch**
- Deploy contracts to mainnet
- Configure production Safe with 4/7 multisig
- Deploy frontend to Vercel/Netlify
- Set up monitoring and alerts
- Verify all integrations
- Enable system for all token holders
- Process first real proposal
- Monitor all metrics
- Provide live support
- Address immediate feedback

---

## 🚀 Detailed Deliverables

### Backend Deliverables
**Automated Services Package**
- 4 core JavaScript services (mirror, relay, prop_forward, prop_submit)
- State management system with JSON persistence
- Error handling and retry mechanisms
- Comprehensive logging system
- Unit and integration tests

**GitHub Actions Pipeline**
- 6 automated workflows with cron scheduling
- Secret management configuration
- Deployment scripts for staging/production
- Rollback procedures
- Monitoring and alerting setup

**API Layer**
- RESTful API for frontend communication
- WebSocket server for real-time updates
- GraphQL endpoint for complex queries
- Rate limiting and caching
- API documentation (OpenAPI spec)

### Frontend Deliverables
**User Application**
- Next.js application with TypeScript
- 6 main pages with responsive design
- Web3 wallet integration
- Real-time proposal updates
- Multi-language support

**Admin Dashboard**
- System monitoring interface
- Safe management tools
- Emergency control panel
- User management system
- Configuration interface

**Mobile Experience**
- Progressive Web App (PWA)
- Push notifications
- Offline capability
- QR code voting
- Mobile-optimized UI

### Smart Contract Deliverables
**Governance Agent**
- Upgradeable proxy contract
- Cross-chain message handling
- Access control system
- Emergency pause mechanism
- Gas optimization

**Safe Modules**
- Reality.eth integration module
- SafeSnap compatibility layer
- Transaction guard contract
- Allowlist management
- Module upgradeability

**Cross-chain Infrastructure**
- LayerZero OApp or Hyperlane Router
- Message verification system
- Retry and timeout logic
- Fee management
- Bridge monitoring

### Documentation Deliverables
**User Documentation**
- Getting started guide
- Video tutorials
- FAQ section
- Troubleshooting guide
- Best practices

**Administrator Documentation**
- System architecture overview
- Deployment guide
- Configuration reference
- Maintenance procedures
- Disaster recovery plan

**Open Source Resources**
- GitHub README with setup instructions
- Basic troubleshooting guide
- Community Discord for support
- Video walkthrough for users

---

## 📊 Success Metrics & KPIs

### Launch Metrics (Day 1)
- System successfully deployed
- First proposal mirrored
- First vote executed
- Zero critical errors

### Week 1 Targets
- 10+ unique voters
- 100% proposal mirror rate
- <5 minute mirror latency
- 99% uptime

### Month 1 Goals
- 25% token holder participation
- 5+ community proposals
- Zero security incidents
- <$500 gas costs

### Quarter 1 Objectives
- 50% participation rate
- 20+ proposals processed
- Community satisfaction >4.5/5
- Template ready for other DAOs

---

## 🛠️ Implementation Plan (Condensed)

### Phase 1: Repository Setup (Days 1-2)
- Create GitHub repository with proper structure
- Set up package.json with required dependencies
- Configure .env.example with all variables
- Add .gitignore for state files and secrets

### Phase 2: Core Scripts (Days 3-8)
- Implement mirror.js for proposal detection
- Build relay.js for vote execution
- Create prop_forward.js for community proposals
- Develop prop_submit.js for proposal submission
- Add error handling and retry logic

### Phase 3: GitHub Actions (Days 9-11)
- Configure mirror.yml workflow (1-minute schedule)
- Set up relay.yml workflow (5-minute schedule)
- Create prop_forward.yml workflow
- Build prop_submit.yml workflow
- Test all workflows with sample data

### Phase 4: Integration & Testing (Days 12-15)
- Create Snapshot spaces with proper strategies
- Configure Gnosis Safe with signers
- Test end-to-end proposal flow
- Verify vote execution works correctly
- Monitor for 48 hours before full launch

---

## 📈 Monitoring & Analytics

### Real-time Metrics Dashboard
**System Health**
- Service uptime percentage
- Response time (p50, p95, p99)
- Error rate by service
- Gas consumption tracking
- API request volume

**Governance Metrics**
- Active proposals count
- Voting participation rate
- Average voting power per proposal
- Proposal success rate
- Time to execution

**User Analytics**
- Daily/Weekly/Monthly active users
- New vs returning voters
- Vote delegation patterns
- Proposal creation frequency
- User geography distribution

**Financial Tracking**
- Gas costs by operation
- Cross-chain message costs
- Infrastructure expenses
- Cost per vote executed
- ROI on automation

**Alert Configuration**
**Critical Alerts**
- Service downtime >5 minutes
- Smart contract errors
- Failed vote executions
- Security anomalies
- Low Safe balance

**Warning Alerts**
- High gas prices
- Slow response times
- Low participation
- Approaching rate limits
- State file corruption

---

## 🔒 Security & Risk Assessment

### Security Measures
1. **Multi-Signature Wallet**
   - Implementation: 4-of-7 signature requirement
   - Risk Mitigation: No single point of failure
   - Recovery: Clear key rotation procedures
2. **Decentralized Oracle**
   - Implementation: Reality.eth integration
   - Risk Mitigation: Eliminates centralized vote counting
   - Verification: Public dispute period for all votes
3. **Cross-Chain Security**
   - Implementation: LayerZero DVNs or Hyperlane ISMs
   - Risk Mitigation: Multiple validator networks
   - Monitoring: Real-time anomaly detection

### Risk Matrix

| Risk                | Probability | Impact  | Mitigation Strategy                                  |
|---------------------|-------------|---------|------------------------------------------------------|
| Key Compromise      | Low         | Critical| Multi-sig, hardware wallets, regular rotation        |
| Smart Contract Bug  | Medium      | High    | Formal audit, extensive testing, bug bounty          |
| Vote Manipulation   | Low         | High    | Oracle verification, dispute period, transparency    |
| Service Downtime    | Medium      | Medium  | Redundant systems, automated recovery                |
| Gas Price Spikes    | High        | Low     | Gas price limits, batching, fallback procedures      |

### Compliance & Governance
- **Transparency:** All code open-source on GitHub
- **Auditability:** Complete transaction logs
- **Accountability:** Clear governance procedures
- **Compliance:** Follows DAO governance standards

---

## 🔧 Maintenance & Support Plan

### Daily Operations
- Monitor system health dashboard
- Review error logs
- Check pending Safe transactions
- Verify proposal synchronization
- Respond to user queries

### Weekly Maintenance
- Review participation metrics
- Update documentation
- Test emergency procedures
- Rotate monitoring duties
- Team sync meeting

### Monthly Updates
- Security patches
- Dependency updates
- Performance optimization
- User feedback review
- Cost analysis

### Quarterly Reviews
- Architecture assessment
- Security audit
- Feature planning
- Budget reconciliation
- Stakeholder reporting

---

## 🎯 Go-Live Checklist

### Pre-Launch Requirements
- All contracts deployed and verified
- Gnosis Safe configured with signers
- Snapshot spaces created and configured
- Frontend deployed and tested
- GitHub Actions running successfully
- Documentation complete
- Security audit passed
- Load testing completed
- Disaster recovery tested
- Team trained on procedures

### Launch Day Tasks
- Final system check
- Enable monitoring alerts
- Announce to community
- Monitor first proposal
- Track initial votes
- Gather feedback
- Address issues
- Document lessons

### Post-Launch Actions
- Daily monitoring for first week
- User feedback sessions
- Performance tuning
- Documentation updates
- Success metrics review

---

## 🚀 Success Metrics

### Key Performance Indicators (KPIs)

| Metric              | Target                     | Measurement                 |
|---------------------|----------------------------|-----------------------------|
| Participation Rate  | >50% of NDA holders        | Monthly active voters       |
| Proposal Success    | >80% executed without errors| Successful transactions     |
| System Uptime       | 99.9%                      | GitHub Actions monitoring   |
| Response Time       | <2 minutes for mirroring   | Automation logs             |
| Security Incidents  | Zero critical              | Security monitoring         |

### Expected Outcomes
**Immediate (Month 1)**
- Functional voting bridge
- First successful cross-DAO vote

**Short-term (Months 2-3)**
- 25% participation rate
- 5+ community proposals

**Long-term (Year 1)**
- 50%+ participation rate
- Template for other DAO integrations
- Established best practices

---

## 📚 Technical Specifications

### Required Configurations
```js
// Key Contract Addresses
const CONFIG = {
  // Ethereum Mainnet
  LIL_NOUNS_GOVERNOR: "0x...", // LilNouns Governor Contract
  GNOSIS_SAFE_ADDRESS: "0x...", // Our Gnosis Safe

  // Base Chain
  NDA_TOKEN_CONTRACT: "0x...", // NDA ERC-721 on Base

  // Snapshot Spaces
  MIRROR_SPACE: "nda-league-of-lils",
  COMMUNITY_SPACE: "lils-africa-props",
  VOTING_SPACE: "lils-africa"
}
```

### API Endpoints & Services

| Service               | Endpoint                                   | Purpose                        |
|-----------------------|--------------------------------------------|--------------------------------|
| Ethereum RPC          | Alchemy/Infura                              | Blockchain interaction         |
| Base RPC              | Base official RPC                           | NDA token queries              |
| Snapshot GraphQL      | hub.snapshot.org                            | Proposal management            |
| Safe Transaction API  | safe-transaction.mainnet.gnosis.io          | Multi-sig coordination         |

### Security Requirements
- Private Key Management: Hardware Security Modules (HSM) preferred
- Access Control: Role-based permissions via Safe
- Monitoring: 24/7 automated alerts for anomalies
- Backup: Redundant key storage with geographic distribution

---

## 🤝 Support & Maintenance

### Ongoing Support Structure
**Technical Support**
- Discord channel for community questions
- Weekly office hours for troubleshooting
- Emergency hotline for critical issues

**Updates & Upgrades**
- Monthly security patches
- Quarterly feature updates
- Annual architecture review

**Documentation**
- User guides for voters
- Admin guides for DAO operators
- Developer documentation for contributors

**Knowledge Transfer**
- Training Sessions: 3 sessions for DAO administrators
- Documentation: Complete operational runbooks
- Handover: 30-day assisted operation period

---

## 📎 Appendices

### A. Alternative Architectures Considered
**Centralized API Service**
- Rejected due to single point of failure
- Higher operational costs

**Direct On-Chain Voting**
- Rejected due to high gas costs
- Poor user experience for non-technical users

**Manual Vote Coordination**
- Rejected due to human error risk
- Not scalable

### B. Future Enhancements
**Multi-DAO Support (Year 2)**
- Template system for new DAOs
- Shared infrastructure

**Mobile Application (Year 2)**
- Native iOS/Android apps
- Push notifications

**AI Governance Assistant (Year 3)**
- Proposal summaries
- Impact analysis

### C. References & Resources
- LilNouns Documentation
- Gnosis Safe Documentation
- Snapshot Documentation
- LayerZero Documentation
- Hyperlane Documentation

---

## 📞 Contact & Questions
- Project Lead: [Your Name]
- Technical Architect: [Technical Lead Name]
- Email: [contact@email.com]
- Discord: [discord-handle]
- GitHub: [github.com/your-org/nda-lilnouns-relay]

---

## 🏁 Project Timeline Summary
**Total Duration:** 15 working days (3 weeks)

**Key Milestones:**
- Day 2: Repository Setup Complete
- Day 8: All Core Scripts Implemented
- Day 11: GitHub Actions Configured
- Day 15: Full Integration Tested & Deployed

**Development Team:**
- In-house developers
- Community contributors
- DAO members as testers
- All work done internally

---

## 🔧 Customization & Troubleshooting

### Customization Options
- Polling Intervals: Edit cron schedules in workflow YAMLs
- Block Range: Modify BLOCK_RANGE for mirror sensitivity
- Voting Parameters: Update choices, time-margin, strategy parameters
- Thresholds: Adjust PASS_THRESHOLD for proposal approval

### Common Issues
- No proposals mirrored: Verify governor address and BLOCK_RANGE
- Relay failures: Check Safe permissions and validate deadlines
- Rate limits: Review GitHub Actions logs for API warnings
- Gas issues: Ensure sufficient ETH in relay accounts

### Monitoring
- GitHub Actions tab shows execution logs
- Proposals appear in Snapshot within ~1 minute
- Votes relay on-chain after proposal close
- State files track processed proposals automatically

---

**Result:** Fully GitHub-hosted, cron-scheduled integration mirroring LilNouns proposals and relaying NDA votes via Gnosis Safe.

This document represents the complete project scope for the NDA ↔ LilNouns Governance Bridge, detailing every component, deliverable, and implementation step required to successfully deploy a production-ready cross-DAO governance system.
