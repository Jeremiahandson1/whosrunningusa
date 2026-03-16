-- Seed issue categories and issues for the Issue Match feature.
-- These are common, nonpartisan policy topics that candidates take positions on.

-- Categories
INSERT INTO issue_categories (id, name, description, icon, applies_to_federal, applies_to_state, applies_to_local, sort_order, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Economy & Jobs', 'Employment, wages, trade, and economic growth', 'dollar-sign', TRUE, TRUE, TRUE, 1, TRUE),
  ('a0000000-0000-0000-0000-000000000002', 'Healthcare', 'Health insurance, drug costs, and public health', 'heart-pulse', TRUE, TRUE, FALSE, 2, TRUE),
  ('a0000000-0000-0000-0000-000000000003', 'Education', 'Public schools, higher education, and student debt', 'graduation-cap', TRUE, TRUE, TRUE, 3, TRUE),
  ('a0000000-0000-0000-0000-000000000004', 'Environment & Energy', 'Climate policy, clean energy, and conservation', 'leaf', TRUE, TRUE, TRUE, 4, TRUE),
  ('a0000000-0000-0000-0000-000000000005', 'Immigration', 'Border security, work visas, and citizenship pathways', 'globe', TRUE, FALSE, FALSE, 5, TRUE),
  ('a0000000-0000-0000-0000-000000000006', 'Criminal Justice', 'Policing, sentencing reform, and public safety', 'shield', TRUE, TRUE, TRUE, 6, TRUE),
  ('a0000000-0000-0000-0000-000000000007', 'Government & Elections', 'Voting rights, campaign finance, and government reform', 'landmark', TRUE, TRUE, TRUE, 7, TRUE),
  ('a0000000-0000-0000-0000-000000000008', 'Housing', 'Affordable housing, zoning, and homelessness', 'home', TRUE, TRUE, TRUE, 8, TRUE),
  ('a0000000-0000-0000-0000-000000000009', 'Civil Rights', 'Equal rights, discrimination, and personal freedoms', 'scale', TRUE, TRUE, TRUE, 9, TRUE),
  ('a0000000-0000-0000-0000-00000000000a', 'National Security', 'Defense spending, foreign policy, and veterans', 'shield-check', TRUE, FALSE, FALSE, 10, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Issues (3-4 per category = ~35 total, covering the major policy questions)
INSERT INTO issues (id, category_id, name, description, sort_order, is_active) VALUES
  -- Economy & Jobs
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Raising the Federal Minimum Wage', 'Should the federal minimum wage be increased to $15/hour or more?', 1, TRUE),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Free Trade Agreements', 'Should the U.S. pursue new free trade agreements with other countries?', 2, TRUE),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Tax Cuts for Small Businesses', 'Should small businesses receive additional tax incentives and deductions?', 3, TRUE),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Strengthening Labor Unions', 'Should workers have expanded rights to organize and collectively bargain?', 4, TRUE),

  -- Healthcare
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Universal Healthcare Coverage', 'Should the government ensure healthcare coverage for all Americans?', 1, TRUE),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'Prescription Drug Price Controls', 'Should the government negotiate or cap prescription drug prices?', 2, TRUE),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'Expanding Mental Health Services', 'Should federal and state funding for mental health services be increased?', 3, TRUE),

  -- Education
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'Student Loan Forgiveness', 'Should the government forgive some or all federal student loan debt?', 1, TRUE),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', 'School Choice and Vouchers', 'Should parents receive public funding to send children to private or charter schools?', 2, TRUE),
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000003', 'Universal Pre-K', 'Should the government fund free preschool for all children?', 3, TRUE),
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000003', 'Increasing Teacher Pay', 'Should there be a federal standard for minimum teacher compensation?', 4, TRUE),

  -- Environment & Energy
  ('b0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000004', 'Transitioning to Renewable Energy', 'Should the U.S. set deadlines for transitioning away from fossil fuels?', 1, TRUE),
  ('b0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000004', 'Carbon Tax', 'Should companies pay a tax based on their carbon emissions?', 2, TRUE),
  ('b0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000004', 'Protecting Public Lands', 'Should federal protections for national parks and public lands be expanded?', 3, TRUE),
  ('b0000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000004', 'Electric Vehicle Incentives', 'Should the government provide subsidies or tax credits for electric vehicles?', 4, TRUE),

  -- Immigration
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005', 'Path to Citizenship for Undocumented Immigrants', 'Should there be a legal pathway to citizenship for undocumented immigrants already in the U.S.?', 1, TRUE),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005', 'Increased Border Security Funding', 'Should the government significantly increase spending on border security?', 2, TRUE),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000005', 'Expanding Legal Immigration', 'Should the U.S. increase the number of legal immigrants and work visas issued each year?', 3, TRUE),

  -- Criminal Justice
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000006', 'Ending Cash Bail', 'Should the cash bail system be eliminated or reformed?', 1, TRUE),
  ('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000006', 'Marijuana Legalization', 'Should marijuana be legalized at the federal level?', 2, TRUE),
  ('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000006', 'Police Reform', 'Should there be federal standards for police use of force and accountability?', 3, TRUE),
  ('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000006', 'Mandatory Minimum Sentencing', 'Should mandatory minimum sentences for nonviolent offenses be reduced or eliminated?', 4, TRUE),

  -- Government & Elections
  ('b0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000007', 'Campaign Finance Reform', 'Should there be stricter limits on money in politics and campaign contributions?', 1, TRUE),
  ('b0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000007', 'Congressional Term Limits', 'Should members of Congress be limited to a set number of terms?', 2, TRUE),
  ('b0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000007', 'Ranked Choice Voting', 'Should elections use ranked choice voting instead of winner-take-all?', 3, TRUE),
  ('b0000000-0000-0000-0000-00000000001a', 'a0000000-0000-0000-0000-000000000007', 'Voter ID Requirements', 'Should voters be required to show government-issued photo ID to vote?', 4, TRUE),

  -- Housing
  ('b0000000-0000-0000-0000-00000000001b', 'a0000000-0000-0000-0000-000000000008', 'Rent Control Policies', 'Should the government be able to limit how much landlords can raise rent?', 1, TRUE),
  ('b0000000-0000-0000-0000-00000000001c', 'a0000000-0000-0000-0000-000000000008', 'Funding Affordable Housing', 'Should the government increase investment in affordable housing construction?', 2, TRUE),
  ('b0000000-0000-0000-0000-00000000001d', 'a0000000-0000-0000-0000-000000000008', 'First-Time Homebuyer Assistance', 'Should the government provide down payment assistance or tax credits for first-time homebuyers?', 3, TRUE),

  -- Civil Rights
  ('b0000000-0000-0000-0000-00000000001e', 'a0000000-0000-0000-0000-000000000009', 'Gun Control Measures', 'Should there be stricter regulations on the purchase and ownership of firearms?', 1, TRUE),
  ('b0000000-0000-0000-0000-00000000001f', 'a0000000-0000-0000-0000-000000000009', 'LGBTQ+ Anti-Discrimination Protections', 'Should federal law prohibit discrimination based on sexual orientation and gender identity?', 2, TRUE),
  ('b0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000009', 'Abortion Access', 'Should access to abortion be protected by federal law?', 3, TRUE),

  -- National Security
  ('b0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-00000000000a', 'Reducing Defense Spending', 'Should the U.S. reduce its military budget and redirect funds to domestic programs?', 1, TRUE),
  ('b0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-00000000000a', 'Veterans Benefits Expansion', 'Should funding for veterans'' healthcare and support services be increased?', 2, TRUE),
  ('b0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-00000000000a', 'Foreign Aid', 'Should the U.S. maintain or increase its foreign aid budget?', 3, TRUE)
ON CONFLICT (id) DO NOTHING;
