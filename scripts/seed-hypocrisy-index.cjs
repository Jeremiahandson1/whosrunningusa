#!/usr/bin/env node

/**
 * Seed Hypocrisy Index Data
 *
 * Populates hypocrisy_index_data for the top 20 US foreign aid recipients
 * with 10 policy comparisons each. Boolean values reflect whether each
 * country and the US have each policy, with factual detail strings and
 * source URLs from WHO, OECD, ILO, and government sources.
 *
 * Usage:
 *   node scripts/seed-hypocrisy-index.js
 *   node scripts/seed-hypocrisy-index.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// US baseline (same for all comparisons)
// ---------------------------------------------------------------------------

const US_POLICIES = {
  'Universal healthcare': {
    has: false,
    detail: 'No universal system. Employer-based insurance with Medicare (65+) and Medicaid (low-income). ~27 million uninsured as of 2023.',
    source: 'https://www.census.gov/library/publications/2024/demo/p60-281.html',
  },
  'Free public university': {
    has: false,
    detail: 'No national free university program. Average public in-state tuition exceeds $10,000/year. Some state-level promise programs exist.',
    source: 'https://nces.ed.gov/fastfacts/display.asp?id=76',
  },
  'Mandatory paid family leave': {
    has: false,
    detail: 'No federal paid family leave mandate. FMLA provides 12 weeks unpaid leave. Some states have paid leave programs.',
    source: 'https://www.dol.gov/agencies/whd/fmla',
  },
  'Free childcare': {
    has: false,
    detail: 'No universal childcare program. Child Care and Development Block Grant subsidizes low-income families. Average cost exceeds $10,000/year per child.',
    source: 'https://www.childcareaware.org/our-issues/research/demand-and-supply/',
  },
  'Dental in public healthcare': {
    has: false,
    detail: 'Medicare does not cover routine dental for most beneficiaries. Medicaid dental varies by state. No universal dental coverage.',
    source: 'https://www.medicare.gov/coverage/dental-services',
  },
  'Vision in public healthcare': {
    has: false,
    detail: 'Medicare covers limited vision services (glaucoma tests, post-cataract lenses). No routine eye exams or glasses. Medicaid varies by state.',
    source: 'https://www.medicare.gov/coverage/eye-exams',
  },
  'High speed rail': {
    has: false,
    detail: 'No national high-speed rail network. Acela reaches 150 mph on limited NE Corridor segments. California HSR under construction since 2015.',
    source: 'https://www.fra.dot.gov/Page/P0674',
  },
  'Mandatory vacation time': {
    has: false,
    detail: 'No federal mandatory paid vacation law. Only developed nation without statutory minimum. Average private sector: 10 days after 1 year.',
    source: 'https://www.bls.gov/ncs/ebs/benefits/2023/employee-benefits-in-the-united-states.htm',
  },
  'Free primary and secondary school': {
    has: true,
    detail: 'Free public K-12 education guaranteed. Funded by state/local taxes. Compulsory attendance laws in all states.',
    source: 'https://nces.ed.gov/fastfacts/display.asp?id=372',
  },
  'Housing assistance programs': {
    has: true,
    detail: 'Section 8 vouchers, public housing, and LIHTC tax credits. HUD budget ~$70B. Long waitlists in most cities; serves ~5 million households.',
    source: 'https://www.hud.gov/topics/rental_assistance',
  },
};

// ---------------------------------------------------------------------------
// Country data: top 20 aid recipients with 10 policies each
// ---------------------------------------------------------------------------

const COUNTRIES = [
  {
    code: 'ISR',
    name: 'Israel',
    policies: {
      'Universal healthcare': { has: true, detail: 'National Health Insurance Law (1995) mandates universal coverage through four competing health funds. All residents covered.', source: 'https://www.who.int/countries/isr' },
      'Free public university': { has: false, detail: 'Tuition charged at public universities (~$3,000/year). Government subsidizes most costs. Free for military veterans via benefits.', source: 'https://che.org.il/en/' },
      'Mandatory paid family leave': { has: true, detail: '15 weeks paid maternity leave at full salary from National Insurance Institute. Fathers get 1 week paid.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=IL&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'Subsidized childcare for working parents. Free preschool from age 3 under Compulsory Education Law.', source: 'https://www.oecd.org/israel/early-childhood-education-and-care-policy-review-israel.htm' },
      'Dental in public healthcare': { has: true, detail: 'Dental care for children up to 18 added to national health basket in 2010. Adult dental partially covered since 2019.', source: 'https://www.health.gov.il/English/' },
      'Vision in public healthcare': { has: true, detail: 'Vision screening included in national health basket. Corrective lenses subsidized for children.', source: 'https://www.health.gov.il/English/' },
      'High speed rail': { has: false, detail: 'No high-speed rail. Tel Aviv-Jerusalem express line opened 2018 at conventional speeds (~160 km/h max). Plans for future expansion.', source: 'https://www.rail.co.il/en' },
      'Mandatory vacation time': { has: true, detail: 'Minimum 10-16 paid vacation days by law depending on seniority, plus religious holidays. Annual Hours of Work and Rest Law.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=IL' },
      'Free primary and secondary school': { has: true, detail: 'Free compulsory education from age 3-18. Compulsory Education Law (1949, amended). State funds Arab, religious, and secular streams.', source: 'https://www.oecd.org/education/Israel-EAG2023-Country-Note.pdf' },
      'Housing assistance programs': { has: true, detail: 'Public housing through Amidar and local authorities. Rent assistance for eligible populations. New immigrant housing absorption benefits.', source: 'https://www.gov.il/en/departments/ministry_of_construction_and_housing' },
    },
  },
  {
    code: 'EGY',
    name: 'Egypt',
    policies: {
      'Universal healthcare': { has: true, detail: 'Universal Health Insurance Law (2018) phased rollout aims for full coverage by 2032. Government-funded for low-income citizens.', source: 'https://www.who.int/countries/egy' },
      'Free public university': { has: true, detail: 'Public universities are tuition-free. Constitution guarantees free education at all levels. Quality varies significantly.', source: 'https://www.egypttoday.com/Article/1/131180/' },
      'Mandatory paid family leave': { has: true, detail: '90 days paid maternity leave at full salary under Labor Law. Limited to 3 times during employment. No paternity leave mandate.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=EG&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No universal free childcare. Employers with 100+ female workers must provide nursery. Limited public day-care centers.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=EG' },
      'Dental in public healthcare': { has: false, detail: 'Basic dental available at government hospitals. Universal health insurance will include dental in phased rollout. Access limited in rural areas.', source: 'https://www.who.int/countries/egy' },
      'Vision in public healthcare': { has: false, detail: 'Basic ophthalmology at government hospitals. New UHI will include vision services. Access limited outside major cities.', source: 'https://www.who.int/countries/egy' },
      'High speed rail': { has: false, detail: 'No operational HSR. $23B contract with Siemens signed 2022 for 2,000km electric rail network including high-speed segments.', source: 'https://press.siemens.com/global/en/pressrelease/siemens-mobility-signs-landmark-mou-egypts-national-authority-tunnels' },
      'Mandatory vacation time': { has: true, detail: '21 days paid annual leave under Labor Law, increasing to 30 days after 10 years. 45 days for workers over 50 or disabled.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=EG' },
      'Free primary and secondary school': { has: true, detail: 'Free compulsory education through secondary level. Constitution mandates free education at all public institutions.', source: 'https://www.oecd.org/countries/egypt/education-in-egypt-2015.htm' },
      'Housing assistance programs': { has: true, detail: 'Social Housing Programme provides subsidized units. Hayah Karima initiative targets rural housing. 500,000+ social housing units planned.', source: 'https://www.worldbank.org/en/news/feature/2020/09/01/social-housing-in-egypt' },
    },
  },
  {
    code: 'UKR',
    name: 'Ukraine',
    policies: {
      'Universal healthcare': { has: true, detail: 'Constitution guarantees free healthcare. National Health Service of Ukraine (NHSU) reformed 2018. State-funded primary care for all citizens.', source: 'https://www.who.int/countries/ukr' },
      'Free public university': { has: true, detail: 'State-funded higher education places allocated by exam. ~50% of students attend tuition-free. Others pay modest fees (~$1,000-3,000/yr).', source: 'https://www.oecd.org/countries/ukraine/' },
      'Mandatory paid family leave': { has: true, detail: '126 days paid maternity leave at 100% salary from social insurance. Extended to 140 days for complications. Paternity leave: 14 days.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=UA&p_sc_id=2' },
      'Free childcare': { has: true, detail: 'Public kindergartens free or nominal fee. State-funded preschool from age 5 (compulsory). Wartime disruptions reduced access.', source: 'https://www.unicef.org/ukraine/en/early-childhood-development' },
      'Dental in public healthcare': { has: true, detail: 'Basic dental included in guaranteed benefits package through NHSU. Emergency dental free at public clinics.', source: 'https://nszu.gov.ua/en' },
      'Vision in public healthcare': { has: true, detail: 'Ophthalmology consultations covered under NHSU. Basic eye exams at public clinics. Glasses/contacts not covered.', source: 'https://nszu.gov.ua/en' },
      'High speed rail': { has: false, detail: 'No dedicated HSR lines. Kyiv-Lviv Intercity+ reaches 160 km/h on upgraded segments. Plans for European-gauge integration.', source: 'https://www.uz.gov.ua/en/' },
      'Mandatory vacation time': { has: true, detail: '24 calendar days minimum paid annual leave under Labor Code. Additional leave for hazardous work and some sectors.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=UA' },
      'Free primary and secondary school': { has: true, detail: 'Free compulsory education grades 1-12. State-funded public schools with centralized curriculum. School meals subsidized.', source: 'https://www.oecd.org/countries/ukraine/education-at-a-glance.htm' },
      'Housing assistance programs': { has: true, detail: 'State housing subsidies for utilities and rent. Affordable mortgage program at 7% for first home. IDP housing programs since 2014.', source: 'https://www.kmu.gov.ua/en' },
    },
  },
  {
    code: 'JOR',
    name: 'Jordan',
    policies: {
      'Universal healthcare': { has: true, detail: 'Civil Insurance Program covers government employees and dependents (~87% coverage). Royal Medical Services covers military. Uninsured access public hospitals.', source: 'https://www.who.int/countries/jor' },
      'Free public university': { has: false, detail: 'Public universities charge tuition ($2,000-5,000/yr). Government scholarships available. Student loan fund established 2003.', source: 'https://www.mohe.gov.jo/en' },
      'Mandatory paid family leave': { has: true, detail: '70 days paid maternity leave at full salary under Labor Law. 3 days paternity leave. Social Security funds maternity benefits.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=JO&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No universal childcare. Employers with 20+ female workers must provide nursery (rarely enforced). Limited public nurseries.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=JO' },
      'Dental in public healthcare': { has: false, detail: 'Basic dental at government health centers. Civil Insurance covers limited dental. Most dental care private and out-of-pocket.', source: 'https://www.who.int/countries/jor' },
      'Vision in public healthcare': { has: false, detail: 'Ophthalmology available at public hospitals. Civil Insurance covers eye conditions. Routine vision screening limited.', source: 'https://www.who.int/countries/jor' },
      'High speed rail': { has: false, detail: 'No high-speed rail. Limited passenger rail (Amman-Zarqa). National Railway Project planned but not funded.', source: 'https://www.mot.gov.jo/' },
      'Mandatory vacation time': { has: true, detail: '14 days paid annual leave, increasing to 21 days after 5 years under Labor Law. Fridays and public holidays additional.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=JO' },
      'Free primary and secondary school': { has: true, detail: 'Free compulsory education grades 1-10. Secondary education (grades 11-12) also free at public schools. ~97% primary enrollment.', source: 'https://www.oecd.org/countries/jordan/' },
      'Housing assistance programs': { has: true, detail: 'Housing and Urban Development Corporation provides subsidized housing. National Aid Fund supports low-income housing. Royal initiatives for military housing.', source: 'https://www.hudc.gov.jo/' },
    },
  },
  {
    code: 'AFG',
    name: 'Afghanistan',
    policies: {
      'Universal healthcare': { has: false, detail: 'Basic Package of Health Services (BPHS) delivered through NGOs. ~60% geographic coverage. Funding heavily donor-dependent. System severely impacted since 2021.', source: 'https://www.who.int/countries/afg' },
      'Free public university': { has: true, detail: 'Public universities tuition-free by law. Entrance via national exam (Kankor). Womens access severely restricted since Taliban return in 2021.', source: 'https://www.hrw.org/news/2022/03/23/afghanistan-taliban-ban-girls-education' },
      'Mandatory paid family leave': { has: true, detail: '90 days paid maternity leave under Labor Law (pre-2021). Current enforcement unclear under Taliban governance.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=AF&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No formal childcare system. Extended family provides care. Some NGO-run early childhood programs in urban areas.', source: 'https://www.unicef.org/afghanistan/' },
      'Dental in public healthcare': { has: false, detail: 'Minimal dental services at district hospitals. BPHS does not include comprehensive dental. Most dental care unavailable outside cities.', source: 'https://www.who.int/countries/afg' },
      'Vision in public healthcare': { has: false, detail: 'Limited ophthalmology at provincial hospitals. NGOs provide eye care programs. High rates of preventable blindness.', source: 'https://www.who.int/countries/afg' },
      'High speed rail': { has: false, detail: 'No functional passenger rail system. Afghanistan has ~75km of rail near borders for freight only.', source: 'https://www.adb.org/countries/afghanistan/transport' },
      'Mandatory vacation time': { has: true, detail: '20 days paid annual leave under Labor Law. Implementation limited to formal sector. Vast majority of workers in informal economy.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=AF' },
      'Free primary and secondary school': { has: true, detail: 'Free public education mandated by constitution. Girls banned from secondary school since 2021 Taliban decree. Boys attendance also declined.', source: 'https://www.unicef.org/afghanistan/education' },
      'Housing assistance programs': { has: false, detail: 'No functioning government housing program. Massive displacement crisis. UN and NGOs provide emergency shelter for IDPs.', source: 'https://www.unhcr.org/countries/afghanistan' },
    },
  },
  {
    code: 'ETH',
    name: 'Ethiopia',
    policies: {
      'Universal healthcare': { has: false, detail: 'Community-Based Health Insurance expanding. Health Extension Programme provides primary care. Out-of-pocket spending ~31% of health expenditure.', source: 'https://www.who.int/countries/eth' },
      'Free public university': { has: true, detail: 'Public universities tuition-free for regular students. Government covers tuition and provides cost-sharing loans for living expenses.', source: 'https://www.moe.gov.et/' },
      'Mandatory paid family leave': { has: true, detail: '120 days maternity leave (30 pre-birth, 90 post-birth) at full pay under Labor Proclamation. No statutory paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=ET&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No national childcare program. Some community-based early childhood care. Only ~15% of children access pre-primary education.', source: 'https://www.unicef.org/ethiopia/early-childhood-development' },
      'Dental in public healthcare': { has: false, detail: 'Dental services limited to major hospitals. ~1 dentist per 250,000 people. Most dental care unavailable in rural areas.', source: 'https://www.who.int/countries/eth' },
      'Vision in public healthcare': { has: false, detail: 'Eye care severely limited. National Eye Care Plan exists but coverage low. ~3.7 million with visual impairment.', source: 'https://www.who.int/countries/eth' },
      'High speed rail': { has: false, detail: 'Addis Ababa Light Rail Transit opened 2015 (urban metro, not HSR). Addis-Djibouti standard gauge railway (freight-focused).', source: 'https://www.erc.gov.et/' },
      'Mandatory vacation time': { has: true, detail: '16 working days paid annual leave, increasing by 1 day per 2 years of service. Labor Proclamation 1156/2019.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=ET' },
      'Free primary and secondary school': { has: true, detail: 'Free public primary education (grades 1-8). Education Sector Development Program expanded access. ~85% primary enrollment.', source: 'https://www.unicef.org/ethiopia/education' },
      'Housing assistance programs': { has: true, detail: 'Integrated Housing Development Programme built 175,000+ condos in Addis Ababa. 20/80 and 40/60 savings-based housing schemes.', source: 'https://www.worldbank.org/en/country/ethiopia' },
    },
  },
  {
    code: 'KEN',
    name: 'Kenya',
    policies: {
      'Universal healthcare': { has: false, detail: 'National Hospital Insurance Fund covers formal sector. Universal Health Coverage pilot launched 2018 in 4 counties. Social Health Insurance Act 2023 expanding coverage.', source: 'https://www.who.int/countries/ken' },
      'Free public university': { has: false, detail: 'Government-sponsored students pay subsidized fees (~$1,000/yr). Higher Education Loans Board provides loans. Full-fee students pay $3,000-5,000/yr.', source: 'https://www.education.go.ke/' },
      'Mandatory paid family leave': { has: true, detail: '3 months paid maternity leave at full salary under Employment Act. 2 weeks paid paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=KE&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'Free pre-primary education (age 4-5) in public schools since 2013. No universal childcare for younger children.', source: 'https://www.unicef.org/kenya/early-childhood-development' },
      'Dental in public healthcare': { has: false, detail: 'Basic dental at county hospitals. ~1 dentist per 20,000 people. Most dental care out-of-pocket.', source: 'https://www.who.int/countries/ken' },
      'Vision in public healthcare': { has: false, detail: 'Limited eye care services at county level. Kenya National Eye Health Strategic Plan aims to improve access.', source: 'https://www.who.int/countries/ken' },
      'High speed rail': { has: false, detail: 'Standard Gauge Railway (Mombasa-Nairobi) opened 2017 at 120 km/h. Not high-speed by international standards.', source: 'https://krc.co.ke/' },
      'Mandatory vacation time': { has: true, detail: '21 working days paid annual leave after 12 months continuous service under Employment Act 2007.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=KE' },
      'Free primary and secondary school': { has: true, detail: 'Free primary education since 2003. Free day secondary education since 2008. Competency-Based Curriculum introduced 2017.', source: 'https://www.education.go.ke/' },
      'Housing assistance programs': { has: true, detail: 'Affordable Housing Programme targeting 250,000 units. Housing Fund levy (1.5% of salary). Kenya Mortgage Refinance Company established.', source: 'https://www.housingandurban.go.ke/' },
    },
  },
  {
    code: 'NGA',
    name: 'Nigeria',
    policies: {
      'Universal healthcare': { has: false, detail: 'National Health Insurance Authority Act 2022 aims for universal coverage. Currently <5% insured. Basic Health Care Provision Fund established.', source: 'https://www.who.int/countries/nga' },
      'Free public university': { has: true, detail: 'Federal universities charge minimal fees. Tuition formally abolished at federal universities. State universities charge varying fees.', source: 'https://education.gov.ng/' },
      'Mandatory paid family leave': { has: true, detail: '12 weeks paid maternity leave at 50% salary under Labor Act. No statutory paternity leave at federal level.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=NG&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No national childcare program. Early childhood education policy exists but implementation limited. ~30% pre-primary enrollment.', source: 'https://www.unicef.org/nigeria/education' },
      'Dental in public healthcare': { has: false, detail: 'Dental services at teaching hospitals only. ~1 dentist per 42,000 people. Vast majority lack dental access.', source: 'https://www.who.int/countries/nga' },
      'Vision in public healthcare': { has: false, detail: 'National Eye Health Programme exists. Coverage very limited. ~4.25 million visually impaired, many treatable.', source: 'https://www.who.int/countries/nga' },
      'High speed rail': { has: false, detail: 'No high-speed rail. Abuja-Kaduna standard gauge railway (2016) operates at 100 km/h. Lagos-Ibadan line under construction.', source: 'https://nrc.gov.ng/' },
      'Mandatory vacation time': { has: true, detail: '6 working days paid annual leave after 12 months under Labor Act. Many employers offer more by contract.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=NG' },
      'Free primary and secondary school': { has: true, detail: 'Universal Basic Education Act (2004) mandates free compulsory 9-year education. Implementation uneven; ~10 million out of school.', source: 'https://www.unicef.org/nigeria/education' },
      'Housing assistance programs': { has: true, detail: 'National Housing Fund (2.5% salary contribution). Federal Housing Authority builds affordable housing. Family Homes Fund targets low-income.', source: 'https://fha.gov.ng/' },
    },
  },
  {
    code: 'COL',
    name: 'Colombia',
    policies: {
      'Universal healthcare': { has: true, detail: 'Universal health coverage since Law 100 (1993). ~97% coverage through contributory and subsidized regimes. Mandatory health insurance for all.', source: 'https://www.who.int/countries/col' },
      'Free public university': { has: false, detail: 'Public universities charge tuition based on socioeconomic bracket. Generacion E program provides scholarships. Average public tuition ~$500-2,000/yr.', source: 'https://www.mineducacion.gov.co/' },
      'Mandatory paid family leave': { has: true, detail: '18 weeks paid maternity leave at 100% salary. 2 weeks paid paternity leave. Funded through social security.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=CO&p_sc_id=2' },
      'Free childcare': { has: true, detail: 'De Cero a Siempre (From Zero to Forever) provides free early childhood care for vulnerable children 0-5. ICBF community homes.', source: 'https://www.icbf.gov.co/' },
      'Dental in public healthcare': { has: true, detail: 'Dental included in mandatory health plan (POS). Basic dental procedures covered. Orthodontics and cosmetic excluded.', source: 'https://www.minsalud.gov.co/' },
      'Vision in public healthcare': { has: true, detail: 'Ophthalmology consultations and basic vision care included in POS. Corrective lenses covered for minors.', source: 'https://www.minsalud.gov.co/' },
      'High speed rail': { has: false, detail: 'No high-speed rail. Passenger rail largely defunct. Regiotram light rail under construction in Bogota region.', source: 'https://www.mintransporte.gov.co/' },
      'Mandatory vacation time': { has: true, detail: '15 working days paid annual leave after 1 year of service under Labor Code.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=CO' },
      'Free primary and secondary school': { has: true, detail: 'Free compulsory education from preschool through grade 11. Constitution mandates free public education. ~96% primary enrollment.', source: 'https://www.mineducacion.gov.co/' },
      'Housing assistance programs': { has: true, detail: 'Mi Casa Ya provides interest rate and down payment subsidies. Free housing program for extreme poverty. Semillero de Propietarios rental assistance.', source: 'https://www.minvivienda.gov.co/' },
    },
  },
  {
    code: 'PAK',
    name: 'Pakistan',
    policies: {
      'Universal healthcare': { has: false, detail: 'Sehat Sahulat Programme covers hospitalization for poorest families. No universal primary care. Out-of-pocket spending ~56% of health expenditure.', source: 'https://www.who.int/countries/pak' },
      'Free public university': { has: false, detail: 'Public university fees subsidized but not free (~$200-1,000/yr). Higher Education Commission provides scholarships. Low enrollment rate (~9%).', source: 'https://www.hec.gov.pk/' },
      'Mandatory paid family leave': { has: true, detail: '12 weeks paid maternity leave at full salary for women in formal sector under provincial laws. No federal paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=PK&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No national childcare program. Limited community-based early childhood education. Only ~36% pre-primary enrollment.', source: 'https://www.unicef.org/pakistan/education' },
      'Dental in public healthcare': { has: false, detail: 'Dental departments at teaching hospitals. Severe dentist shortage (~1 per 10,000). Most dental care private and urban.', source: 'https://www.who.int/countries/pak' },
      'Vision in public healthcare': { has: false, detail: 'National Eye Health Programme exists. Coverage limited. ~2 million blind, mostly preventable. LRBT provides free eye care through charitable hospitals.', source: 'https://www.who.int/countries/pak' },
      'High speed rail': { has: false, detail: 'No high-speed rail. ML-1 railway upgrade ($6.8B CPEC project) planned to reach 160 km/h. Currently max ~100 km/h.', source: 'https://www.railways.gov.pk/' },
      'Mandatory vacation time': { has: true, detail: '14 days paid annual leave after 12 months under Factories Act. Shop workers: 14 days. Various provincial variations.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=PK' },
      'Free primary and secondary school': { has: true, detail: 'Article 25-A guarantees free compulsory education ages 5-16. Implementation gaps: ~22 million out of school.', source: 'https://www.unicef.org/pakistan/education' },
      'Housing assistance programs': { has: true, detail: 'Naya Pakistan Housing Programme targets 5 million housing units. Markup subsidy for low-income home buyers. Provincial programs vary.', source: 'https://www.naphda.gov.pk/' },
    },
  },
  {
    code: 'IRQ',
    name: 'Iraq',
    policies: {
      'Universal healthcare': { has: true, detail: 'Free public healthcare guaranteed by constitution. Government-run health centers and hospitals. Quality severely impacted by conflict and brain drain.', source: 'https://www.who.int/countries/irq' },
      'Free public university': { has: true, detail: 'Public universities tuition-free. Central admission system based on national exam scores. Private universities also operating.', source: 'https://www.mohesr.gov.iq/' },
      'Mandatory paid family leave': { has: true, detail: '72 days paid maternity leave at full salary under Labor Law. Extended unpaid leave available. No statutory paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=IQ&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'Limited public kindergartens. Government nurseries for public employees in some ministries. No universal program.', source: 'https://www.unicef.org/iraq/education' },
      'Dental in public healthcare': { has: true, detail: 'Dental services at public health centers and hospitals. Free for citizens. Quality and availability varies by region.', source: 'https://www.who.int/countries/irq' },
      'Vision in public healthcare': { has: true, detail: 'Ophthalmology services at public hospitals. Free for citizens. Specialist availability concentrated in major cities.', source: 'https://www.who.int/countries/irq' },
      'High speed rail': { has: false, detail: 'No high-speed rail. Rail network damaged by conflicts. Baghdad-Basra line operates at low speeds. Reconstruction ongoing.', source: 'https://www.iraqirailways.com/' },
      'Mandatory vacation time': { has: true, detail: '20 days paid annual leave, increasing with seniority. Government employees: 20-36 days. Labor Law No. 37 of 2015.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=IQ' },
      'Free primary and secondary school': { has: true, detail: 'Free compulsory education ages 6-15 (through grade 6 mandatory, secondary free but not compulsory).', source: 'https://www.unicef.org/iraq/education' },
      'Housing assistance programs': { has: true, detail: 'National Investment Commission promotes housing projects. Real Estate Bank provides subsidized mortgages. IDP housing reconstruction ongoing.', source: 'https://www.moch.gov.iq/' },
    },
  },
  {
    code: 'SSD',
    name: 'South Sudan',
    policies: {
      'Universal healthcare': { has: false, detail: 'Health system barely functional. ~80% of services delivered by NGOs. 1 doctor per 65,000 people. Out-of-pocket spending dominates.', source: 'https://www.who.int/countries/ssd' },
      'Free public university': { has: true, detail: 'University of Juba and public institutions nominally tuition-free. Severe funding shortages. Enrollment extremely low.', source: 'https://www.moest.gov.ss/' },
      'Mandatory paid family leave': { has: true, detail: '8 weeks paid maternity leave under Labor Act 2017. Practice largely limited to formal sector (very small share of economy).', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=SS' },
      'Free childcare': { has: false, detail: 'No formal childcare system. Community and family-based care only. One of lowest pre-primary enrollment rates globally.', source: 'https://www.unicef.org/southsudan/education' },
      'Dental in public healthcare': { has: false, detail: 'Almost no dental services available. Fewer than 10 dentists in the entire country. Dental care effectively non-existent.', source: 'https://www.who.int/countries/ssd' },
      'Vision in public healthcare': { has: false, detail: 'Minimal eye care services. A handful of ophthalmologists for 11 million people. NGOs provide most eye care.', source: 'https://www.who.int/countries/ssd' },
      'High speed rail': { has: false, detail: 'No railway infrastructure. Country has no operational rail lines.', source: 'https://www.worldbank.org/en/country/southsudan' },
      'Mandatory vacation time': { has: true, detail: '20 days paid annual leave under Labor Act 2017. Enforcement limited to formal sector.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=SS' },
      'Free primary and secondary school': { has: true, detail: 'Free primary education policy. ~70% of children out of school. Conflict, poverty, and displacement limit access severely.', source: 'https://www.unicef.org/southsudan/education' },
      'Housing assistance programs': { has: false, detail: 'No government housing programs. ~2 million IDPs and ~2 million refugees. Humanitarian agencies provide emergency shelter.', source: 'https://www.unhcr.org/countries/south-sudan' },
    },
  },
  {
    code: 'COD',
    name: 'DR Congo',
    policies: {
      'Universal healthcare': { has: false, detail: 'Universal Health Coverage law passed 2023. Currently <10% have insurance. Health system critically underfunded at $21 per capita.', source: 'https://www.who.int/countries/cod' },
      'Free public university': { has: false, detail: 'Public university students pay fees (varies by institution). Government scholarships very limited. Higher education access extremely low.', source: 'https://www.unicef.org/drcongo/en/education' },
      'Mandatory paid family leave': { has: true, detail: '14 weeks paid maternity leave at 67% salary under Labor Code. No statutory paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=CD&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No formal childcare system. Extended family provides care. Pre-primary enrollment ~5%.', source: 'https://www.unicef.org/drcongo/en/early-childhood' },
      'Dental in public healthcare': { has: false, detail: 'Dental services virtually absent outside major cities. Severe shortage of dental professionals.', source: 'https://www.who.int/countries/cod' },
      'Vision in public healthcare': { has: false, detail: 'Eye care extremely limited. National eye health program underfunded. NGOs provide most vision services.', source: 'https://www.who.int/countries/cod' },
      'High speed rail': { has: false, detail: 'No functional passenger rail system. Colonial-era rail network largely defunct. Some mining rail used for freight.', source: 'https://www.worldbank.org/en/country/drc' },
      'Mandatory vacation time': { has: true, detail: '12 working days paid annual leave per year under Labor Code. Increases with seniority.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=CD' },
      'Free primary and secondary school': { has: true, detail: 'Free primary education mandated since 2019 (Gratuity Policy). Previously parents paid fees. Implementation challenges persist.', source: 'https://www.unicef.org/drcongo/en/education' },
      'Housing assistance programs': { has: false, detail: 'No functional government housing program. Massive informal settlements. ~5 million IDPs require shelter assistance.', source: 'https://www.unhcr.org/countries/democratic-republic-congo' },
    },
  },
  {
    code: 'SOM',
    name: 'Somalia',
    policies: {
      'Universal healthcare': { has: false, detail: 'Health system fragmented across federal member states. <2% of GDP on health. Most care delivered by NGOs. Very limited government capacity.', source: 'https://www.who.int/countries/som' },
      'Free public university': { has: true, detail: 'Some public universities nominally free (Somali National University reopened). Most higher education private. Very low enrollment.', source: 'https://www.moe.gov.so/' },
      'Mandatory paid family leave': { has: true, detail: '14 weeks paid maternity leave at 50% salary under Labor Code. Enforcement near zero due to informal economy dominance.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=SO' },
      'Free childcare': { has: false, detail: 'No formal childcare system. Family and clan networks provide care. Pre-primary education virtually non-existent.', source: 'https://www.unicef.org/somalia/education' },
      'Dental in public healthcare': { has: false, detail: 'Dental services almost non-existent. No dental schools in country. Emergency dental only at rare facilities.', source: 'https://www.who.int/countries/som' },
      'Vision in public healthcare': { has: false, detail: 'Eye care severely limited. Few ophthalmologists in entire country. International organizations provide periodic eye camps.', source: 'https://www.who.int/countries/som' },
      'High speed rail': { has: false, detail: 'No railway infrastructure. Country has never had an operational railway system.', source: 'https://www.worldbank.org/en/country/somalia' },
      'Mandatory vacation time': { has: true, detail: '15 days paid annual leave under Labor Code. Formal sector extremely small.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=SO' },
      'Free primary and secondary school': { has: true, detail: 'Free primary education policy exists. ~50% of children out of school. Al-Shabaab controls education in some areas.', source: 'https://www.unicef.org/somalia/education' },
      'Housing assistance programs': { has: false, detail: 'No government housing programs. ~2.9 million IDPs. Humanitarian agencies provide emergency shelter.', source: 'https://www.unhcr.org/countries/somalia' },
    },
  },
  {
    code: 'SYR',
    name: 'Syria',
    policies: {
      'Universal healthcare': { has: true, detail: 'Constitution guarantees free healthcare. Pre-war system provided near-universal coverage. Civil war destroyed ~50% of health facilities.', source: 'https://www.who.int/countries/syr' },
      'Free public university': { has: true, detail: 'Public universities tuition-free. Entrance by national exam. University system severely disrupted by conflict. Many faculty emigrated.', source: 'https://www.mohe.gov.sy/' },
      'Mandatory paid family leave': { has: true, detail: '120 days maternity leave (75% pay for first 40 days, full pay after) under Labor Law. 3 days paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=SY&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'Government nurseries existed pre-war in some public institutions. System largely collapsed. Some NGO-run centers in displacement camps.', source: 'https://www.unicef.org/syria/' },
      'Dental in public healthcare': { has: true, detail: 'Dental services at public hospitals pre-war. Severely reduced capacity. Many dentists left the country.', source: 'https://www.who.int/countries/syr' },
      'Vision in public healthcare': { has: true, detail: 'Ophthalmology services at government hospitals. Capacity greatly diminished by conflict and emigration of specialists.', source: 'https://www.who.int/countries/syr' },
      'High speed rail': { has: false, detail: 'No high-speed rail. Pre-war rail network (2,700 km) largely destroyed. Damascus-Aleppo line inoperable.', source: 'https://www.worldbank.org/en/country/syria' },
      'Mandatory vacation time': { has: true, detail: '15 days paid annual leave, increasing to 21 after 10 years under Labor Law.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=SY' },
      'Free primary and secondary school': { has: true, detail: 'Free compulsory education grades 1-9. Pre-war ~97% enrollment. ~2.4 million children out of school due to conflict.', source: 'https://www.unicef.org/syria/education' },
      'Housing assistance programs': { has: false, detail: 'Pre-war subsidized housing programs. Massive destruction: ~35% of housing stock damaged or destroyed. Reconstruction slow.', source: 'https://www.worldbank.org/en/country/syria' },
    },
  },
  {
    code: 'LBN',
    name: 'Lebanon',
    policies: {
      'Universal healthcare': { has: false, detail: 'Fragmented system. National Social Security Fund covers formal workers. Ministry of Public Health covers uninsured. ~50% lack adequate coverage. System in crisis since 2019.', source: 'https://www.who.int/countries/lbn' },
      'Free public university': { has: true, detail: 'Lebanese University (only public university) is tuition-free. Nominal registration fees. Enrolls ~40% of all university students.', source: 'https://www.ul.edu.lb/' },
      'Mandatory paid family leave': { has: true, detail: '10 weeks paid maternity leave at full salary under Labor Code. No statutory paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=LB&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No public childcare system. Private nurseries expensive. Some NGO-supported centers for refugee populations.', source: 'https://www.unicef.org/lebanon/early-childhood-development' },
      'Dental in public healthcare': { has: false, detail: 'Dental not covered by NSSF. Primary healthcare centers offer limited dental. Most dental care private and expensive.', source: 'https://www.who.int/countries/lbn' },
      'Vision in public healthcare': { has: false, detail: 'Vision care limited in public system. NSSF covers some ophthalmology. Most vision care private sector.', source: 'https://www.who.int/countries/lbn' },
      'High speed rail': { has: false, detail: 'No railway system. Rail network defunct since civil war (1975). No active plans for rail revival.', source: 'https://www.worldbank.org/en/country/lebanon' },
      'Mandatory vacation time': { has: true, detail: '15 days paid annual leave after 1 year under Labor Code. Up to 21 days based on collective agreements.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=LB' },
      'Free primary and secondary school': { has: true, detail: 'Free public education at all levels. ~70% attend private schools by choice. Public school quality has declined.', source: 'https://www.mehe.gov.lb/' },
      'Housing assistance programs': { has: false, detail: 'Public Corporation for Housing provides some subsidized loans. No public housing stock. Severe housing crisis with ~1.5M refugees.', source: 'https://www.worldbank.org/en/country/lebanon' },
    },
  },
  {
    code: 'TZA',
    name: 'Tanzania',
    policies: {
      'Universal healthcare': { has: false, detail: 'Community Health Fund and National Health Insurance Fund cover ~32% of population. Improved Community Health Fund expanding. Goal of UHC by 2030.', source: 'https://www.who.int/countries/tza' },
      'Free public university': { has: false, detail: 'Public university students pay fees (~$1,500-3,000/yr). Higher Education Students Loans Board provides loans. Government sponsors some students.', source: 'https://www.heslb.go.tz/' },
      'Mandatory paid family leave': { has: true, detail: '84 days paid maternity leave at full salary under Employment and Labour Relations Act. 3 days paid paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=TZ&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'Limited pre-primary education in public schools (1 year). No universal childcare. Community-based programs supported by NGOs.', source: 'https://www.unicef.org/tanzania/education' },
      'Dental in public healthcare': { has: false, detail: 'Dental services at regional hospitals. Severe shortage of dentists. Most dental care unavailable in rural areas.', source: 'https://www.who.int/countries/tza' },
      'Vision in public healthcare': { has: false, detail: 'National Eye Care Programme exists. Eye care concentrated in urban centers. High prevalence of preventable blindness.', source: 'https://www.who.int/countries/tza' },
      'High speed rail': { has: false, detail: 'Standard Gauge Railway under construction (Dar es Salaam - Mwanza). Designed for 160 km/h. Not classified as high-speed. Phases ongoing.', source: 'https://www.trc.go.tz/' },
      'Mandatory vacation time': { has: true, detail: '28 days paid annual leave under Employment and Labour Relations Act 2004.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=TZ' },
      'Free primary and secondary school': { has: true, detail: 'Fee-free basic education policy since 2016 (primary and lower secondary). Enrollment surged. Quality challenges remain.', source: 'https://www.unicef.org/tanzania/education' },
      'Housing assistance programs': { has: true, detail: 'National Housing Corporation provides affordable housing. Tanzania Mortgage Refinance Company supports mortgage market. 20,000 Affordable Homes initiative.', source: 'https://www.nhc.co.tz/' },
    },
  },
  {
    code: 'UGA',
    name: 'Uganda',
    policies: {
      'Universal healthcare': { has: false, detail: 'National Health Insurance Bill pending since 2019. Free public healthcare policy but severe underfunding. Out-of-pocket spending ~40%.', source: 'https://www.who.int/countries/uga' },
      'Free public university': { has: false, detail: 'Makerere and public universities offer government-sponsored places (~4,000/yr). Private-sponsored students pay fees. Low higher education enrollment.', source: 'https://www.education.go.ug/' },
      'Mandatory paid family leave': { has: true, detail: '60 working days paid maternity leave at full salary under Employment Act 2006. 4 days paid paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=UG&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No public childcare system. Pre-primary education largely private. Government pre-primary policy introduced 2023.', source: 'https://www.unicef.org/uganda/education' },
      'Dental in public healthcare': { has: false, detail: 'Dental units at regional referral hospitals. <1 dentist per 100,000 people. Most lack access to dental care.', source: 'https://www.who.int/countries/uga' },
      'Vision in public healthcare': { has: false, detail: 'Uganda National Eye Care Program. Limited coverage. ~1 ophthalmologist per 1 million people.', source: 'https://www.who.int/countries/uga' },
      'High speed rail': { has: false, detail: 'No high-speed rail. Standard gauge railway planned (Malaba-Kampala) as part of East African SGR network. Colonial-era meter gauge operational.', source: 'https://www.sgr.go.ug/' },
      'Mandatory vacation time': { has: true, detail: '21 working days paid annual leave after 12 months under Employment Act 2006.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=UG' },
      'Free primary and secondary school': { has: true, detail: 'Universal Primary Education since 1997. Universal Secondary Education since 2007. Free tuition at government schools. Quality concerns.', source: 'https://www.education.go.ug/' },
      'Housing assistance programs': { has: true, detail: 'National Housing Policy 2016. National Housing and Construction Company builds affordable units. Uganda Mortgage Refinance Company supports market.', source: 'https://www.mlhud.go.ug/' },
    },
  },
  {
    code: 'MOZ',
    name: 'Mozambique',
    policies: {
      'Universal healthcare': { has: false, detail: 'Free public healthcare policy but severe resource constraints. ~50% lack access to health facility within 30 min. $18 per capita health spending.', source: 'https://www.who.int/countries/moz' },
      'Free public university': { has: false, detail: 'Public universities charge fees. Eduardo Mondlane University subsidized but not free. Government scholarships limited. Very low enrollment.', source: 'https://www.mctestp.gov.mz/' },
      'Mandatory paid family leave': { has: true, detail: '60 days paid maternity leave at 100% salary under Labor Law. 1 day paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=MZ&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No public childcare system. Pre-primary enrollment ~5%. Community-based early childhood programs very limited.', source: 'https://www.unicef.org/mozambique/education' },
      'Dental in public healthcare': { has: false, detail: 'Dental services at provincial hospitals only. Extreme shortage of dental professionals. Most population lacks any dental access.', source: 'https://www.who.int/countries/moz' },
      'Vision in public healthcare': { has: false, detail: 'Very limited eye care. National program exists but underfunded. Most ophthalmologists in Maputo.', source: 'https://www.who.int/countries/moz' },
      'High speed rail': { has: false, detail: 'No high-speed rail. Existing rail corridors (Nacala, Beira, Maputo) primarily for freight. Passenger service limited.', source: 'https://www.worldbank.org/en/country/mozambique' },
      'Mandatory vacation time': { has: true, detail: '12 working days paid annual leave in first year, increasing to 30 days after 20+ years under Labor Law.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=MZ' },
      'Free primary and secondary school': { has: true, detail: 'Free primary education policy. School fees abolished in 2004. ~90% gross enrollment in primary. High dropout rates.', source: 'https://www.unicef.org/mozambique/education' },
      'Housing assistance programs': { has: false, detail: 'National housing policy exists but minimal implementation. Fund for Housing Promotion (FFH) limited capacity. Massive housing deficit.', source: 'https://www.worldbank.org/en/country/mozambique' },
    },
  },
  {
    code: 'BGD',
    name: 'Bangladesh',
    policies: {
      'Universal healthcare': { has: false, detail: 'Free public healthcare at government facilities but severe overcrowding. Out-of-pocket spending ~74% of health expenditure. No national insurance.', source: 'https://www.who.int/countries/bgd' },
      'Free public university': { has: true, detail: 'Public universities charge nominal fees (~$20-50/yr). Government heavily subsidizes. National University system enrolls majority of students.', source: 'https://www.ugc.gov.bd/' },
      'Mandatory paid family leave': { has: true, detail: '16 weeks paid maternity leave at full salary under Bangladesh Labour Act 2006. No statutory paternity leave.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=BD&p_sc_id=2' },
      'Free childcare': { has: false, detail: 'No national childcare program. Government pre-primary class (1 year) in primary schools. NGOs run early childhood programs.', source: 'https://www.unicef.org/bangladesh/education' },
      'Dental in public healthcare': { has: false, detail: 'Dental departments at government medical college hospitals. Severe shortage. ~1 dentist per 25,000 people.', source: 'https://www.who.int/countries/bgd' },
      'Vision in public healthcare': { has: false, detail: 'National Eye Care Programme exists. Eye care available at district hospitals. NGOs provide significant eye services.', source: 'https://www.who.int/countries/bgd' },
      'High speed rail': { has: false, detail: 'No high-speed rail. Rail network (~2,900 km) operates at low speeds. Padma Bridge rail link under development.', source: 'https://www.railway.gov.bd/' },
      'Mandatory vacation time': { has: true, detail: '10 days paid annual leave for factory workers; 18 days for shop/commercial workers under Labour Act 2006.', source: 'https://www.ilo.org/dyn/travail/travmain.sectionReport1?p_lang=en&p_countries=BD' },
      'Free primary and secondary school': { has: true, detail: 'Free compulsory primary education (grades 1-5). Free secondary education for girls. Female secondary stipend program since 1994.', source: 'https://www.unicef.org/bangladesh/education' },
      'Housing assistance programs': { has: true, detail: 'Ashrayan Project provides housing for homeless. National Housing Authority builds affordable housing. Grihayan Tahbil provides housing loans.', source: 'https://www.nha.gov.bd/' },
    },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Seed Hypocrisy Index Data ===`);
  console.log(`Countries: ${COUNTRIES.length}`);
  console.log(`Policies per country: 10`);
  console.log(`Total records: ${COUNTRIES.length * 10}`);
  console.log(`Dry run: ${dryRun}\n`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const country of COUNTRIES) {
    console.log(`--- ${country.name} (${country.code}) ---`);

    for (const [policyName, policy] of Object.entries(country.policies)) {
      const usPolicy = US_POLICIES[policyName];
      if (!usPolicy) {
        console.log(`  WARNING: No US baseline for "${policyName}"`);
        errors++;
        continue;
      }

      if (dryRun) {
        const match = policy.has === usPolicy.has ? '=' : policy.has ? '>' : '<';
        console.log(`  [DRY RUN] ${policyName}: ${country.name}=${policy.has} ${match} US=${usPolicy.has}`);
        continue;
      }

      try {
        const { rows } = await pool.query(
          `INSERT INTO hypocrisy_index_data
             (country_code, country_name, policy_name, policy_category,
              country_has_it, us_has_it, country_detail, us_detail,
              source_url, last_verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE)
           ON CONFLICT (country_code, policy_name) DO UPDATE SET
             country_name = EXCLUDED.country_name,
             policy_category = EXCLUDED.policy_category,
             country_has_it = EXCLUDED.country_has_it,
             us_has_it = EXCLUDED.us_has_it,
             country_detail = EXCLUDED.country_detail,
             us_detail = EXCLUDED.us_detail,
             source_url = EXCLUDED.source_url,
             last_verified = CURRENT_DATE,
             updated_at = NOW()
           RETURNING (xmax = 0) AS is_insert`,
          [
            country.code,
            country.name,
            policyName,
            getCategoryForPolicy(policyName),
            policy.has,
            usPolicy.has,
            policy.detail,
            usPolicy.detail,
            policy.source,
          ]
        );

        if (rows[0].is_insert) inserted++;
        else updated++;
      } catch (err) {
        console.error(`  ERROR on ${policyName}: ${err.message}`);
        errors++;
      }
    }

    if (!dryRun) {
      const countryPolicies = Object.entries(country.policies);
      const countryHas = countryPolicies.filter(([, p]) => p.has).length;
      const usHas = countryPolicies.filter(([name]) => US_POLICIES[name]?.has).length;
      console.log(`  ${country.name}: ${countryHas}/10 policies | US: ${usHas}/10 policies`);
    }
  }

  if (!dryRun) {
    console.log(`\n=== Seed Complete ===`);
    console.log(`Inserted: ${inserted}  Updated: ${updated}  Errors: ${errors}`);
    console.log(`Total: ${inserted + updated}`);
  } else {
    console.log(`\n[DRY RUN] Would process ${COUNTRIES.length * 10} records`);
  }

  await pool.end();
}

function getCategoryForPolicy(policyName) {
  const categories = {
    'Universal healthcare': 'healthcare',
    'Free public university': 'education',
    'Mandatory paid family leave': 'labor',
    'Free childcare': 'family',
    'Dental in public healthcare': 'healthcare',
    'Vision in public healthcare': 'healthcare',
    'High speed rail': 'infrastructure',
    'Mandatory vacation time': 'labor',
    'Free primary and secondary school': 'education',
    'Housing assistance programs': 'housing',
  };
  return categories[policyName] || 'other';
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
