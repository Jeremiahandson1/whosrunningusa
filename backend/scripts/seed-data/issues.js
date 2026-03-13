/**
 * Issue definitions organized by category name.
 * Categories are already seeded in schema.sql.
 * Each issue has: name, description, question_text
 */

module.exports = {
  'Economy & Jobs': [
    { name: 'Federal Minimum Wage Increase', description: 'Raising the federal minimum wage from $7.25/hr', question_text: 'Do you support raising the federal minimum wage to $15/hr or higher?' },
    { name: 'Tax Reform', description: 'Restructuring federal income and corporate tax rates', question_text: 'Do you support lowering corporate tax rates to promote economic growth?' },
    { name: 'Labor Union Rights', description: 'Protecting and expanding collective bargaining rights', question_text: 'Do you support the PRO Act to strengthen union organizing rights?' },
    { name: 'Small Business Support', description: 'Tax incentives and reduced regulations for small businesses', question_text: 'Do you support expanding SBA lending programs and reducing regulations for small businesses?' },
    { name: 'Student Loan Forgiveness', description: 'Cancellation or reduction of federal student loan debt', question_text: 'Do you support broad federal student loan forgiveness programs?' },
    { name: 'National Debt Reduction', description: 'Reducing the federal deficit and national debt', question_text: 'Do you support a balanced budget amendment to the Constitution?' },
    { name: 'Social Security Reform', description: 'Ensuring long-term solvency of Social Security', question_text: 'Do you support raising the Social Security payroll tax cap to extend solvency?' },
    { name: 'Trade Policy', description: 'Tariffs, trade agreements, and import/export regulations', question_text: 'Do you support using tariffs as a tool to protect American manufacturing?' },
  ],
  'Education': [
    { name: 'Public School Funding', description: 'Increasing federal investment in K-12 public education', question_text: 'Do you support increasing federal funding for public schools?' },
    { name: 'School Choice & Vouchers', description: 'Public funding for private and charter school attendance', question_text: 'Do you support school voucher programs that allow public funds for private schools?' },
    { name: 'Universal Pre-K', description: 'Government-funded preschool for all children', question_text: 'Do you support federally funded universal pre-kindergarten?' },
    { name: 'Teacher Pay', description: 'Increasing compensation for public school teachers', question_text: 'Do you support federal programs to increase teacher salaries?' },
    { name: 'Higher Education Affordability', description: 'Making college and trade schools more accessible', question_text: 'Do you support tuition-free community college programs?' },
    { name: 'Book Bans & Curriculum', description: 'Policies around school library materials and curriculum content', question_text: 'Do you support parents having veto power over school library and curriculum materials?' },
  ],
  'Healthcare': [
    { name: 'Public Health Insurance Option', description: 'Government-run health insurance available to all Americans', question_text: 'Do you support creating a public option for health insurance?' },
    { name: 'Abortion Access', description: 'Legal protections for reproductive healthcare and abortion', question_text: 'Do you support federal legislation protecting abortion access?' },
    { name: 'Prescription Drug Pricing', description: 'Government negotiation of drug prices and cost caps', question_text: 'Do you support allowing Medicare to negotiate prescription drug prices?' },
    { name: 'Medicare Expansion', description: 'Expanding Medicare eligibility and covered services', question_text: 'Do you support lowering the Medicare eligibility age?' },
    { name: 'Mental Health Funding', description: 'Increasing access to mental health services', question_text: 'Do you support increased federal funding for community mental health centers?' },
    { name: 'ACA Protections', description: 'Maintaining or modifying the Affordable Care Act', question_text: 'Do you support maintaining the Affordable Care Act and its pre-existing condition protections?' },
  ],
  'Environment': [
    { name: 'Carbon Emissions Reduction', description: 'Policies to reduce greenhouse gas emissions', question_text: 'Do you support binding targets to achieve net-zero carbon emissions by 2050?' },
    { name: 'Renewable Energy Investment', description: 'Federal subsidies and tax credits for clean energy', question_text: 'Do you support expanding federal tax credits for solar and wind energy?' },
    { name: 'Fossil Fuel Production', description: 'Policies on oil, gas, and coal extraction on federal lands', question_text: 'Do you support banning new fossil fuel drilling on federal lands?' },
    { name: 'Paris Climate Agreement', description: 'U.S. participation in international climate accords', question_text: 'Do you support U.S. participation in the Paris Climate Agreement?' },
    { name: 'Electric Vehicle Transition', description: 'Incentives for EV adoption and charging infrastructure', question_text: 'Do you support federal incentives to accelerate electric vehicle adoption?' },
    { name: 'Clean Water Protections', description: 'Federal regulation of water quality and pollution', question_text: 'Do you support strengthening Clean Water Act protections for wetlands and waterways?' },
  ],
  'Public Safety': [
    { name: 'Gun Background Checks', description: 'Universal background checks for all firearm purchases', question_text: 'Do you support universal background checks for all gun sales including private sales?' },
    { name: 'Assault Weapons Ban', description: 'Banning sale of semi-automatic assault-style weapons', question_text: 'Do you support a federal ban on assault-style weapons?' },
    { name: 'Police Reform', description: 'Changes to policing practices, accountability, and funding', question_text: 'Do you support federal standards for police use-of-force and accountability?' },
    { name: 'Criminal Justice Reform', description: 'Sentencing reform, rehabilitation programs, and reducing incarceration', question_text: 'Do you support reducing mandatory minimum sentences for non-violent offenses?' },
    { name: 'Death Penalty', description: 'Federal use of capital punishment', question_text: 'Do you support abolishing the federal death penalty?' },
    { name: 'Fentanyl & Drug Policy', description: 'Addressing the opioid crisis and drug trafficking', question_text: 'Do you support increased federal funding to combat fentanyl trafficking?' },
  ],
  'Civil Rights': [
    { name: 'Voting Rights Protections', description: 'Federal legislation to protect and expand voting access', question_text: 'Do you support the John Lewis Voting Rights Advancement Act?' },
    { name: 'LGBTQ+ Equality', description: 'Federal protections against discrimination based on sexual orientation and gender identity', question_text: 'Do you support the Equality Act to ban LGBTQ+ discrimination nationwide?' },
    { name: 'Racial Justice', description: 'Addressing systemic racial inequity through federal policy', question_text: 'Do you support federal reparations studies or programs to address historical racial injustice?' },
    { name: 'Women\'s Rights', description: 'Equal pay, workplace protections, and gender equity', question_text: 'Do you support the Equal Rights Amendment to the Constitution?' },
    { name: 'Affirmative Action', description: 'Race-conscious policies in education and employment', question_text: 'Do you support affirmative action programs in federal contracting?' },
  ],
  'Immigration': [
    { name: 'Border Security', description: 'Physical barriers, technology, and personnel at U.S. borders', question_text: 'Do you support increased physical border barriers along the southern border?' },
    { name: 'Pathway to Citizenship', description: 'Legal status options for undocumented immigrants', question_text: 'Do you support a pathway to citizenship for long-term undocumented residents?' },
    { name: 'DACA Protections', description: 'Legal status for childhood arrivals (Dreamers)', question_text: 'Do you support permanent legal protections for DACA recipients?' },
    { name: 'Legal Immigration Reform', description: 'Visa systems, green card backlogs, and immigration levels', question_text: 'Do you support increasing the number of legal immigration visas issued annually?' },
    { name: 'Refugee & Asylum Policy', description: 'U.S. acceptance and processing of refugees and asylum seekers', question_text: 'Do you support maintaining or expanding U.S. refugee admissions?' },
  ],
  'Government & Ethics': [
    { name: 'Congressional Term Limits', description: 'Limiting the number of terms for members of Congress', question_text: 'Do you support a constitutional amendment for Congressional term limits?' },
    { name: 'Campaign Finance Reform', description: 'Limiting money in politics and increasing transparency', question_text: 'Do you support overturning Citizens United through a constitutional amendment?' },
    { name: 'Supreme Court Reform', description: 'Changes to the structure or size of the Supreme Court', question_text: 'Do you support expanding the number of Supreme Court justices?' },
    { name: 'Electoral College Reform', description: 'Modifying or abolishing the Electoral College system', question_text: 'Do you support moving to a national popular vote for presidential elections?' },
    { name: 'Congressional Stock Trading Ban', description: 'Prohibiting members of Congress from trading individual stocks', question_text: 'Do you support banning members of Congress from trading individual stocks while in office?' },
    { name: 'Filibuster Reform', description: 'Changing or eliminating the Senate filibuster', question_text: 'Do you support eliminating or reforming the Senate filibuster?' },
  ],
  'Foreign Policy': [
    { name: 'Ukraine Support', description: 'Military and financial aid to Ukraine', question_text: 'Do you support continued U.S. military and financial aid to Ukraine?' },
    { name: 'China Relations', description: 'Trade, technology, and diplomatic policy toward China', question_text: 'Do you support a tougher stance on China including technology export restrictions?' },
    { name: 'Israel-Palestine', description: 'U.S. policy on the Israeli-Palestinian conflict', question_text: 'Do you support conditioning U.S. military aid to Israel on human rights compliance?' },
    { name: 'NATO Commitment', description: 'U.S. role in and support for the NATO alliance', question_text: 'Do you support maintaining full U.S. commitment to NATO?' },
    { name: 'Defense Spending', description: 'Level of annual U.S. military spending', question_text: 'Do you support increasing the U.S. defense budget?' },
    { name: 'Iran Nuclear Policy', description: 'Diplomatic approach to Iran\'s nuclear program', question_text: 'Do you support diplomatic negotiations to limit Iran\'s nuclear capabilities?' },
  ],
  'Infrastructure': [
    { name: 'Broadband Internet Access', description: 'Expanding high-speed internet to rural and underserved areas', question_text: 'Do you support federal investment to bring broadband to all Americans?' },
    { name: 'Road & Bridge Repair', description: 'Federal funding for aging transportation infrastructure', question_text: 'Do you support increased federal spending on road and bridge maintenance?' },
    { name: 'Public Transit Expansion', description: 'Investing in trains, buses, and urban transit systems', question_text: 'Do you support expanding federal funding for public transit systems?' },
    { name: 'Power Grid Modernization', description: 'Upgrading the electrical grid for reliability and clean energy', question_text: 'Do you support major federal investment to modernize the power grid?' },
    { name: 'Water Infrastructure', description: 'Replacing lead pipes and upgrading water treatment systems', question_text: 'Do you support federal funding to replace all lead water pipes nationwide?' },
  ],
  'Housing': [
    { name: 'Affordable Housing Construction', description: 'Federal investment in building affordable housing units', question_text: 'Do you support increased federal funding for affordable housing construction?' },
    { name: 'Rent Control', description: 'Federal limits on how much landlords can increase rent', question_text: 'Do you support federal rent control or stabilization policies?' },
    { name: 'First-Time Homebuyer Assistance', description: 'Down payment assistance and tax credits for new homebuyers', question_text: 'Do you support expanding federal first-time homebuyer programs?' },
    { name: 'Zoning Reform', description: 'Federal incentives to reform local zoning laws', question_text: 'Do you support federal incentives for cities to reduce restrictive zoning?' },
    { name: 'Homelessness Reduction', description: 'Federal programs to reduce and prevent homelessness', question_text: 'Do you support a Housing First approach to federal homelessness policy?' },
  ],
  'Local Issues': [
    { name: 'Property Tax Reform', description: 'Changes to local property tax assessment and rates', question_text: 'Do you support reforming property tax assessment methods to reduce burden on homeowners?' },
    { name: 'Local Police Budgets', description: 'Funding levels for local law enforcement', question_text: 'Do you support increasing your local police department budget?' },
    { name: 'Public Parks & Recreation', description: 'Investment in local parks, trails, and recreation facilities', question_text: 'Do you support increased local spending on parks and recreation?' },
    { name: 'Local Business Development', description: 'Incentives and programs to attract businesses to the area', question_text: 'Do you support tax incentives to attract new businesses to your community?' },
    { name: 'School Board Authority', description: 'Scope of decision-making power for local school boards', question_text: 'Do you support expanding local school board authority over curriculum decisions?' },
  ],
};
