/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Concurrent Bot Simulator & Scalability Load Test Suite
 *
 * Simulates X concurrent random bots taking an assessment with realistic, varied
 * skill profiles (10% to 98% accuracy), distinct student identities, and syncs
 * all submissions to both the Express backend and Firebase Firestore.
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

interface TestMetrics {
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  durationMs: number;
  throughputRps: number;
  latenciesMs: number[];
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  memoryUsageMb: number;
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  let bots = process.env.BOTS ? parseInt(process.env.BOTS, 10) : 0;
  let code = process.env.CODE || '';
  let baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--bots=')) {
      bots = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--bots' && args[i + 1]) {
      bots = parseInt(args[++i], 10);
    } else if (arg.startsWith('--code=')) {
      code = arg.split('=')[1].trim().toUpperCase();
    } else if (arg === '--code' && args[i + 1]) {
      code = args[++i].trim().toUpperCase();
    } else if (arg.startsWith('--url=')) {
      baseUrl = arg.split('=')[1].trim().replace(/\/+$/, '');
    } else if (arg === '--url' && args[i + 1]) {
      baseUrl = args[++i].trim().replace(/\/+$/, '');
    } else if (/^\d+$/.test(arg) && !bots) {
      bots = parseInt(arg, 10);
    }
  }

  return { bots, code, baseUrl };
}

const { bots: CLI_BOTS, code: CLI_CODE, baseUrl: BASE_URL } = parseCliArgs();

// Initialize Firestore connection so bot runs also sync with Cloud Firestore
let firestoreDb: ReturnType<typeof getFirestore> | null = null;
try {
  if (fs.existsSync('./firebase-applet-config.json')) {
    const firebaseCfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
    if (firebaseCfg.apiKey && firebaseCfg.projectId) {
      const app = initializeApp(firebaseCfg);
      firestoreDb = getFirestore(app, firebaseCfg.firestoreDatabaseId);
    }
  }
} catch {
  firestoreDb = null;
}

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Rohan', 'Karthik', 'Siddharth', 'Pranav',
  'Ananya', 'Diya', 'Priya', 'Sneha', 'Kavya', 'Ishita', 'Meera', 'Neha',
  'Vikram', 'Rahul', 'Nikhil', 'Varun', 'Tanvi', 'Pooja', 'Riya', 'Shreya',
  'Dev', 'Harsh', 'Kunal', 'Manish', 'Nandini', 'Ritu', 'Saurabh', 'Yash',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Nair', 'Reddy', 'Iyer', 'Gupta', 'Singh',
  'Kulkarni', 'Joshi', 'Mehta', 'Rao', 'Chatterjee', 'Das', 'Menon', 'Kapoor',
  'bansal', 'Agarwal', 'Deshmukh', 'Tiwari', 'Chauhan', 'Malhotra', 'Saxena', 'bhatt',
];

const COLLEGES = [
  'IIT Delhi', 'NIT Trichy', 'BITS Pilani', 'IIIT Hyderabad', 'VIT Vellore',
  'DTU Delhi', 'NIT Surathkal', 'RVCE Bengaluru', 'COEP Pune', 'SRM Institute',
  'IIT Bombay', 'Jadavpur University', 'MANIT Bhopal', 'VNIT Nagpur', 'PEC Chandigarh',
];

const BRANCHES = [
  'Computer Science & Engineering',
  'Information Technology',
  'Electronics & Communication',
  'Artificial Intelligence & Data Science',
  'Electrical Engineering',
  'Mechanical Engineering',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeHttpRequest(
  method: string,
  path: string,
  body?: any,
  botIndex: number = 1
): Promise<{ statusCode: number; data: any; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const payload = body ? JSON.stringify(body) : null;
    const targetUrl = new URL(`${BASE_URL}${path}`);
    const client = targetUrl.protocol === 'https:' ? https : http;

    const simulatedIp = `10.${40 + (Math.floor(botIndex / 60000) % 200)}.${
      Math.floor(botIndex / 250) % 250
    }.${(botIndex % 250) + 1}`;

    const req = client.request(
      targetUrl,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': simulatedIp,
          'x-load-test-token': 'attlic-benchmark',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          const latencyMs = Date.now() - startTime;
          let parsed = {};
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = { raw: rawData };
          }
          resolve({
            statusCode: res.statusCode || 500,
            data: parsed,
            latencyMs,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

/**
 * Ensures the target assessment code exists in the local Express server by syncing it
 * from Firestore (`assessments` or `publicAssessments`) if needed.
 * Returns the full assessment (with answer keys if available) so bots can intentionally vary their accuracy.
 */
async function ensureAssessmentSynced(code: string): Promise<any | null> {
  const cleanCode = code.trim().toUpperCase();
  let fullAssessment: any = null;

  // 1. Check local data/assessments.json first (avoids unnecessary Firestore reads)
  try {
    if (fs.existsSync('./data/assessments.json')) {
      const localList = JSON.parse(fs.readFileSync('./data/assessments.json', 'utf8'));
      if (Array.isArray(localList)) {
        const localMatch = localList.find(
          (a: any) => (a.code || '').trim().toUpperCase() === cleanCode
        );
        if (localMatch) {
          fullAssessment = { ...localMatch, code: cleanCode, status: 'published' };
        }
      }
    }
  } catch {
    // ignore local read error
  }

  // 2. Check Firestore if not yet found locally
  if (!fullAssessment && firestoreDb) {
    try {
      const pubDoc = await getDoc(doc(firestoreDb, 'publicAssessments', cleanCode));
      if (pubDoc.exists()) {
        const pubData = pubDoc.data();
        if (pubData?.id) {
          const origDoc = await getDoc(doc(firestoreDb, 'assessments', pubData.id));
          if (origDoc.exists()) {
            fullAssessment = {
              ...origDoc.data(),
              id: origDoc.id,
              code: cleanCode,
              status: 'published',
            };
          }
        }
        if (!fullAssessment) {
          fullAssessment = { ...pubData, code: cleanCode, status: 'published' };
        }
      }

      if (!fullAssessment) {
        const snap = await getDocs(collection(firestoreDb, 'assessments'));
        snap.forEach((d) => {
          const data = d.data();
          if ((data.code || '').toUpperCase() === cleanCode) {
            fullAssessment = { ...data, id: d.id, status: 'published' };
          }
        });
      }
    } catch (err) {
      console.warn('Firestore lookup notice (using local Express store):', (err as Error).message);
    }
  }

  // 3. If the requested code is not yet in local storage (e.g. created on another host while Firestore quota is full),
  // provision it using the recruiter's primary assessment template so the load test & dashboard work immediately
  if (!fullAssessment) {
    let templateSections: any[] | null = null;
    let totalMarks = 100;
    let passingMarks = 40;
    let durationMinutes = 45;

    try {
      if (fs.existsSync('./data/assessments.json')) {
        const localList = JSON.parse(fs.readFileSync('./data/assessments.json', 'utf8'));
        const richTemplate = localList.find(
          (a: any) =>
            a.recruiterEmail === 'vinayakvarun.online@gmail.com' &&
            Array.isArray(a.sections) &&
            a.sections.length > 0 &&
            a.sections[0]?.questions?.length > 0
        );
        if (richTemplate) {
          templateSections = richTemplate.sections;
          totalMarks = richTemplate.totalMarks || 112;
          passingMarks = richTemplate.passingMarks || 45;
          durationMinutes = richTemplate.durationMinutes || 45;
        }
      }
    } catch {
      // fallback below
    }

    fullAssessment = {
      id: `assess_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      code: cleanCode,
      title:
        cleanCode.startsWith('INDIAN-GOV')
          ? 'Indian Government Technical & Aptitude Recruitment Examination'
          : `Placement Assessment (${cleanCode})`,
      description: `Official high-concurrency online recruitment examination for code ${cleanCode}.`,
      organizationId: 'org_vinayakvarun_online_gmail_com',
      organizationName: "Vinayak Varun's Recruitment Drive",
      recruiterId: '41RJghlwVcgLF09b7anoem7t4jG3',
      recruiterEmail: 'vinayakvarun.online@gmail.com',
      status: 'published',
      durationMinutes,
      totalMarks,
      passingMarks,
      passingPercentage: 40,
      showImmediateResults: true,
      sections: templateSections || [
        {
          id: 'sec_1',
          title: 'Section A: General Intelligence, Quantitative Aptitude & Technical Core',
          order: 1,
          questions: [
            {
              id: 'q1',
              type: 'single_choice',
              title: 'What is the average time complexity of QuickSort?',
              marks: 10,
              negativeMarks: 2,
              options: [
                { id: 'opt_1_a', text: 'O(n log n)', isCorrect: true },
                { id: 'opt_1_b', text: 'O(n^2)' },
                { id: 'opt_1_c', text: 'O(log n)' },
                { id: 'opt_1_d', text: 'O(n)' },
              ],
              correctOptionIds: ['opt_1_a'],
            },
            {
              id: 'q2',
              type: 'single_choice',
              title: 'Which data structure uses LIFO order?',
              marks: 10,
              negativeMarks: 2,
              options: [
                { id: 'opt_2_a', text: 'Queue' },
                { id: 'opt_2_b', text: 'Stack', isCorrect: true },
                { id: 'opt_2_c', text: 'Heap' },
                { id: 'opt_2_d', text: 'Tree' },
              ],
              correctOptionIds: ['opt_2_b'],
            },
            {
              id: 'q3',
              type: 'true_false',
              title: 'HTTP/2 supports binary framing and multiplexing.',
              marks: 10,
              negativeMarks: 1,
              options: [
                { id: 'opt_3_true', text: 'True', isCorrect: true },
                { id: 'opt_3_false', text: 'False' },
              ],
              correctOptionIds: ['opt_3_true'],
            },
            {
              id: 'q4',
              type: 'multiple_choice',
              title: 'Which of the following are ACID properties in RDBMS?',
              marks: 10,
              negativeMarks: 2,
              options: [
                { id: 'opt_4_a', text: 'Atomicity', isCorrect: true },
                { id: 'opt_4_b', text: 'Consistency', isCorrect: true },
                { id: 'opt_4_c', text: 'Isolation', isCorrect: true },
                { id: 'opt_4_d', text: 'Availability' },
              ],
              correctOptionIds: ['opt_4_a', 'opt_4_b', 'opt_4_c'],
            },
            {
              id: 'q5',
              type: 'short_text',
              title: 'Name the command used to clone a git repository.',
              marks: 10,
              negativeMarks: 0,
              shortTextAcceptedAnswers: ['git clone', 'clone'],
            },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  if (fullAssessment) {
    // Normalize legacy timestamp organizationIds to deterministic org_${cleanEmail} when recruiterEmail is present
    if (
      fullAssessment.recruiterEmail &&
      typeof fullAssessment.recruiterEmail === 'string' &&
      fullAssessment.recruiterEmail.includes('@') &&
      (!fullAssessment.organizationId || /^org_\d+/.test(fullAssessment.organizationId))
    ) {
      const cleanEmail = fullAssessment.recruiterEmail
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 32);
      fullAssessment.organizationId = `org_${cleanEmail}`;
    }

    // Sync to local Express server so /api/assessments/code/:code works seamlessly
    await makeHttpRequest('POST', '/api/assessments', fullAssessment, 0);
    // Also ensure Firestore assessments document has the updated code & published status when quota permits
    if (firestoreDb && fullAssessment.id) {
      try {
        await setDoc(doc(firestoreDb, 'assessments', fullAssessment.id), fullAssessment, {
          merge: true,
        });
      } catch {
        // Ignore if rules or quota block
      }
    }
  }

  return fullAssessment;
}

// 1. Setup multi-organization assessments when no custom --code is specified
async function setupBenchmarkAssessments() {
  console.log('--- Initializing multi-organization benchmark assessments ---');

  const orgs = [
    { id: 'org_loadtest_alpha', name: 'Alpha Tech Systems', code: 'LOADTEST-ALPHA-101' },
    { id: 'org_loadtest_beta', name: 'Beta Financial Corp', code: 'LOADTEST-BETA-202' },
    { id: 'org_loadtest_gamma', name: 'Gamma Deep Labs', code: 'LOADTEST-GAMMA-303' },
  ];

  for (const org of orgs) {
    const assessment = {
      id: `assess_${org.id}`,
      organizationId: org.id,
      organizationName: org.name,
      recruiterId: `recruiter_${org.id}`,
      recruiterEmail: `recruiter@${org.id}.internal`,
      code: org.code,
      title: `${org.name} High-Concurrency Examination`,
      description: 'Stress-test examination drive simulating concurrent candidate sessions.',
      status: 'published',
      durationMinutes: 60,
      totalMarks: 50,
      passingMarks: 20,
      passingPercentage: 40,
      sections: [
        {
          id: 'sec_1',
          title: 'Section A: Algorithms & Data Structures',
          order: 1,
          questions: [
            {
              id: 'q1',
              type: 'single_choice',
              title: 'What is the average time complexity of QuickSort?',
              marks: 10,
              negativeMarks: 2,
              options: [
                { id: 'opt_1_a', text: 'O(n log n)', isCorrect: true },
                { id: 'opt_1_b', text: 'O(n^2)' },
                { id: 'opt_1_c', text: 'O(log n)' },
                { id: 'opt_1_d', text: 'O(n)' },
              ],
              correctOptionIds: ['opt_1_a'],
            },
            {
              id: 'q2',
              type: 'single_choice',
              title: 'Which data structure uses LIFO order?',
              marks: 10,
              negativeMarks: 2,
              options: [
                { id: 'opt_2_a', text: 'Queue' },
                { id: 'opt_2_b', text: 'Stack', isCorrect: true },
                { id: 'opt_2_c', text: 'Heap' },
                { id: 'opt_2_d', text: 'Tree' },
              ],
              correctOptionIds: ['opt_2_b'],
            },
            {
              id: 'q3',
              type: 'true_false',
              title: 'HTTP/2 supports binary framing and multiplexing.',
              marks: 10,
              negativeMarks: 1,
              options: [
                { id: 'opt_3_true', text: 'True', isCorrect: true },
                { id: 'opt_3_false', text: 'False' },
              ],
              correctOptionIds: ['opt_3_true'],
            },
            {
              id: 'q4',
              type: 'multiple_choice',
              title: 'Which of the following are ACID properties in RDBMS?',
              marks: 10,
              negativeMarks: 2,
              options: [
                { id: 'opt_4_a', text: 'Atomicity', isCorrect: true },
                { id: 'opt_4_b', text: 'Consistency', isCorrect: true },
                { id: 'opt_4_c', text: 'Isolation', isCorrect: true },
                { id: 'opt_4_d', text: 'Availability' },
              ],
              correctOptionIds: ['opt_4_a', 'opt_4_b', 'opt_4_c'],
            },
            {
              id: 'q5',
              type: 'short_text',
              title: 'Name the command used to clone a git repository.',
              marks: 10,
              negativeMarks: 0,
              shortTextAcceptedAnswers: ['git clone', 'clone'],
            },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await makeHttpRequest('POST', '/api/assessments', assessment, 0);
    if (res.statusCode !== 200) {
      throw new Error(`Failed to initialize assessment for ${org.id}: ${JSON.stringify(res.data)}`);
    }
  }

  console.log('✓ Successfully created 3 organization benchmark assessments.');
  return orgs.map((o) => o.code);
}

/**
 * Generates diverse, realistic bot answers based on each bot's individual skill level (`botSkillProb` in [0.12, 0.96])
 * so every bot answers differently and produces a realistic distribution of scores.
 */
function buildDifferentiatedBotAnswers(
  candidateAssessment: any,
  fullAssessmentWithKeys: any | null,
  botIndex: number,
  totalBots: number
): Record<string, any> {
  const answers: Record<string, any> = {};
  const sections = Array.isArray(candidateAssessment?.sections) ? candidateAssessment.sections : [];

  // Map full questions by ID if we have the full assessment from Firestore
  const answerKeyMap = new Map<string, any>();
  if (fullAssessmentWithKeys && Array.isArray(fullAssessmentWithKeys.sections)) {
    for (const sec of fullAssessmentWithKeys.sections) {
      for (const q of sec.questions || []) {
        answerKeyMap.set(q.id, q);
      }
    }
  }

  // Give each bot a distinct skill target between 12% and 96% + random jitter
  const baseSkill = 0.12 + ((botIndex - 1) / Math.max(1, totalBots - 1)) * 0.84;
  const botSkillProb = Math.min(0.98, Math.max(0.08, baseSkill + (Math.random() - 0.5) * 0.14));
  // Attempt rate between 70% and 100%
  const attemptRate = 0.70 + Math.random() * 0.30;

  for (const section of sections) {
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    for (const q of questions) {
      if (Math.random() > attemptRate) continue; // Unattempted question

      const fullQ = answerKeyMap.get(q.id) || q;
      const shouldAnswerCorrectly = Math.random() < botSkillProb;

      if (q.type === 'coding_problem') {
        const starterPy =
          q.codingConfig?.starterCode?.python ||
          `import sys\ndata = [int(x) for x in sys.stdin.read().strip().split()]\nif len(data) > 1:\n    print(sum(data[1:1+data[0]]))\n`;
        answers[q.id] = {
          questionId: q.id,
          selectedOptionIds: [],
          codingLanguage: 'python',
          codeAnswer: shouldAnswerCorrectly ? starterPy : 'print(0)\n',
          isMarkedForReview: Math.random() < 0.1,
          visited: true,
          timeSpentSeconds: Math.floor(Math.random() * 140) + 25,
        };
      } else if (q.type === 'short_text') {
        const accepted =
          Array.isArray(fullQ.shortTextAcceptedAnswers) && fullQ.shortTextAcceptedAnswers.length > 0
            ? fullQ.shortTextAcceptedAnswers
            : ['git clone', 'pwd'];
        const wrongTexts = ['unknown', 'none', 'N/A', 'skip', 'incorrect_value'];
        answers[q.id] = {
          questionId: q.id,
          selectedOptionIds: [],
          textAnswer: shouldAnswerCorrectly ? randomItem<string>(accepted) : randomItem(wrongTexts),
          isMarkedForReview: false,
          visited: true,
          timeSpentSeconds: Math.floor(Math.random() * 45) + 8,
        };
      } else if (q.type === 'multiple_choice' && Array.isArray(q.options) && q.options.length > 0) {
        const fullOpts = Array.isArray(fullQ.options) ? fullQ.options : q.options;
        const correctIds: string[] =
          Array.isArray(fullQ.correctOptionIds) && fullQ.correctOptionIds.length > 0
            ? fullQ.correctOptionIds
            : fullOpts.filter((o: any) => o.isCorrect).map((o: any) => o.id);

        let selected: string[] = [];
        if (shouldAnswerCorrectly && correctIds.length > 0) {
          selected = [...correctIds];
        } else {
          selected = q.options
            .filter(() => Math.random() < 0.45)
            .map((o: any) => o.id);
          if (selected.length === 0) {
            selected.push(randomItem<any>(q.options).id);
          }
        }
        answers[q.id] = {
          questionId: q.id,
          selectedOptionIds: selected,
          isMarkedForReview: Math.random() < 0.12,
          visited: true,
          timeSpentSeconds: Math.floor(Math.random() * 50) + 10,
        };
      } else if (Array.isArray(q.options) && q.options.length > 0) {
        const fullOpts = Array.isArray(fullQ.options) ? fullQ.options : q.options;
        const correctIds: string[] =
          Array.isArray(fullQ.correctOptionIds) && fullQ.correctOptionIds.length > 0
            ? fullQ.correctOptionIds
            : fullOpts.filter((o: any) => o.isCorrect).map((o: any) => o.id);

        let chosenId: string;
        if (shouldAnswerCorrectly && correctIds.length > 0) {
          chosenId = correctIds[0];
        } else {
          const wrongOpts = q.options.filter((o: any) => !correctIds.includes(o.id));
          chosenId =
            wrongOpts.length > 0
              ? randomItem<any>(wrongOpts).id
              : randomItem<any>(q.options).id;
        }

        answers[q.id] = {
          questionId: q.id,
          selectedOptionIds: [chosenId],
          isMarkedForReview: Math.random() < 0.1,
          visited: true,
          timeSpentSeconds: Math.floor(Math.random() * 40) + 6,
        };
      }
    }
  }

  return answers;
}

export interface BotOutcomeSummary {
  botNo: number;
  name: string;
  rollNumber: string;
  college: string;
  score: number | null;
  totalMarks: number;
  percentage: number | null;
  passed: boolean | null;
  tabSwitches: number;
}

// 2. Candidate Lifecycle Simulation
async function simulateCandidateFlow(
  candidateIndex: number,
  totalBots: number,
  assessmentCode: string,
  fullAssessmentWithKeys: any | null,
  latencies: number[],
  outcomes: BotOutcomeSummary[],
  firestoreQueue: any[]
): Promise<boolean> {
  const candidateName = `BOT-${candidateIndex}`;
  const candidateEmail = `bot-${candidateIndex}.${Date.now() % 100000}@campus.edu`;
  const rollNumber = `BOT-${candidateIndex}`;
  const college = COLLEGES[(candidateIndex - 1) % COLLEGES.length];
  const branch = BRANCHES[(candidateIndex - 1) % BRANCHES.length];

  try {
    // Step A: Candidate Lookup / Assessment Start (Verifying no correct answers leaked)
    const lookupRes = await makeHttpRequest(
      'GET',
      `/api/assessments/code/${encodeURIComponent(assessmentCode)}`,
      undefined,
      candidateIndex
    );
    latencies.push(lookupRes.latencyMs);
    if (lookupRes.statusCode !== 200 || !lookupRes.data.success) {
      return false;
    }

    const returnedAssessment = lookupRes.data.assessment;
    const questions = returnedAssessment.sections?.[0]?.questions || [];
    for (const q of questions) {
      if (q.correctOptionIds || q.correctAnswers) {
        throw new Error('SECURITY VIOLATION: Correct answer keys leaked in candidate response!');
      }
      for (const opt of q.options || []) {
        if (opt.isCorrect !== undefined) {
          throw new Error('SECURITY VIOLATION: isCorrect flag leaked in candidate option response!');
        }
      }
    }

    // Step B: Generate differentiated bot answers
    const answers = buildDifferentiatedBotAnswers(
      returnedAssessment,
      fullAssessmentWithKeys,
      candidateIndex,
      totalBots
    );

    // Step C: Submission with Authoritative Server Evaluation
    const tabSwitches = candidateIndex % 5 === 0 ? (candidateIndex % 3) + 1 : 0;
    const submitRes = await makeHttpRequest(
      'POST',
      `/api/assessments/code/${encodeURIComponent(assessmentCode)}/submit`,
      {
        candidate: {
          id: `cand_bot_${candidateIndex}_${Date.now()}`,
          name: candidateName,
          email: candidateEmail,
          rollNumber,
          college,
          branch,
          graduationYear: 2026,
          phone: `98${String(10000000 + candidateIndex * 137).slice(0, 8)}`,
          cgpa: (6.8 + ((candidateIndex * 7) % 30) / 10).toFixed(2),
        },
        answers,
        tabSwitchCount: tabSwitches,
        violationLogs:
          tabSwitches > 0
            ? [
                {
                  type: 'tab_switch',
                  timestamp: new Date().toISOString(),
                  message: `${candidateName} switched browser tab (${tabSwitches}x)`,
                },
              ]
            : [],
        startedAt: new Date(Date.now() - (Math.floor(Math.random() * 1400) + 400) * 1000).toISOString(),
      },
      candidateIndex
    );

    latencies.push(submitRes.latencyMs);
    if (submitRes.statusCode !== 200 || !submitRes.data.success) {
      return false;
    }

    const attempt = submitRes.data.attempt;

    if (attempt && attempt.id) {
      firestoreQueue.push({
        ...attempt,
        organizationId:
          fullAssessmentWithKeys?.organizationId ||
          returnedAssessment.organizationId ||
          attempt.organizationId ||
          'org_default',
        assessmentId:
          fullAssessmentWithKeys?.id ||
          returnedAssessment.id ||
          attempt.assessmentId,
        assessmentCode: assessmentCode,
        candidateName: candidateName,
        candidateEmail: candidateEmail,
        rollNumber,
        college,
        branch,
      });
    }

    outcomes.push({
      botNo: candidateIndex,
      name: candidateName,
      rollNumber,
      college,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      passed: attempt.passed,
      tabSwitches,
    });

    return true;
  } catch {
    return false;
  }
}

// 3. Concurrency Tier Runner
async function runConcurrencyTier(
  concurrency: number,
  testCodes: string[],
  fullAssessmentMap: Map<string, any>
): Promise<{ metrics: TestMetrics; outcomes: BotOutcomeSummary[] }> {
  console.log(`\n======================================================`);
  console.log(`Executing Bot Simulation: ${concurrency} Concurrent Candidates`);
  console.log(`Target Exam Code(s):      ${testCodes.join(', ')}`);
  console.log(`======================================================`);

  const latencies: number[] = [];
  const outcomes: BotOutcomeSummary[] = [];
  const firestoreQueue: any[] = [];
  const startTime = Date.now();
  let successfulRequests = 0;
  let failedRequests = 0;

  const CHUNK_SIZE = 100;
  for (let i = 0; i < concurrency; i += CHUNK_SIZE) {
    const chunkEnd = Math.min(i + CHUNK_SIZE, concurrency);
    const promises: Promise<boolean>[] = [];

    for (let c = i; c < chunkEnd; c++) {
      const code = testCodes[c % testCodes.length];
      const fullAssess = fullAssessmentMap.get(code) || null;
      promises.push(
        simulateCandidateFlow(
          c + 1,
          concurrency,
          code,
          fullAssess,
          latencies,
          outcomes,
          firestoreQueue
        )
      );
    }

    const results = await Promise.all(promises);
    for (const ok of results) {
      if (ok) {
        successfulRequests++;
      } else {
        failedRequests++;
      }
    }
  }

  const durationMs = Date.now() - startTime;

  // Batch-sync all attempts to Cloud Firestore so BOT-1..BOT-N appear in Recruiter Dashboard
  if (firestoreDb && firestoreQueue.length > 0) {
    const BATCH_LIMIT = 200;
    for (let b = 0; b < firestoreQueue.length; b += BATCH_LIMIT) {
      try {
        const batch = writeBatch(firestoreDb);
        const slice = firestoreQueue.slice(b, b + BATCH_LIMIT);
        for (const att of slice) {
          batch.set(doc(firestoreDb, 'attempts', att.id), att);
        }
        await batch.commit();
      } catch {
        // Ignore if offline
      }
    }
  }
  const totalRequests = (successfulRequests + failedRequests) * 2;
  const throughputRps = Math.round((totalRequests / Math.max(0.001, durationMs / 1000)) * 10) / 10;

  latencies.sort((a, b) => a - b);
  const p50Ms = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95Ms = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99Ms = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const maxMs = latencies[latencies.length - 1] || 0;

  const mem = Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;

  const metrics: TestMetrics = {
    concurrency,
    totalRequests,
    successfulRequests,
    failedRequests,
    durationMs,
    throughputRps,
    latenciesMs: latencies,
    p50Ms,
    p95Ms,
    p99Ms,
    maxMs,
    memoryUsageMb: mem,
  };

  console.log(`Candidates Completed: ${successfulRequests} / ${concurrency}`);
  console.log(`Duration:            ${durationMs} ms`);
  console.log(`Throughput:          ${throughputRps} req/s`);
  console.log(`Latency p50:         ${p50Ms} ms`);
  console.log(`Latency p95:         ${p95Ms} ms`);
  console.log(`Latency p99:         ${p99Ms} ms`);
  console.log(`Latency Max:         ${maxMs} ms`);
  console.log(
    `Failures:            ${failedRequests} (Error rate: ${((failedRequests / concurrency) * 100).toFixed(2)}%)`
  );
  console.log(`Memory RSS:          ${mem} MB`);

  return { metrics, outcomes };
}

async function main() {
  console.log('attlic - Concurrent Exam Bot Simulator & Load Benchmark');

  try {
    const fullAssessmentMap = new Map<string, any>();
    let testCodes: string[] = [];

    if (CLI_CODE) {
      const synced = await ensureAssessmentSynced(CLI_CODE);
      if (synced) {
        fullAssessmentMap.set(CLI_CODE, synced);
        console.log(
          `✓ Loaded assessment "${synced.title}" (Code: ${CLI_CODE}, Org: ${synced.organizationId})`
        );
      }
      testCodes = [CLI_CODE];
    } else {
      testCodes = await setupBenchmarkAssessments();
    }

    if (CLI_BOTS > 0) {
      const { metrics: customTier, outcomes } = await runConcurrencyTier(
        CLI_BOTS,
        testCodes,
        fullAssessmentMap
      );

      outcomes.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const scores = outcomes.map((o) => o.score ?? 0);
      const passedCount = outcomes.filter((o) => o.passed).length;
      const avgScore =
        scores.length > 0
          ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
          : 0;
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
      const minScore = scores.length > 0 ? Math.min(...scores) : 0;
      const uniqueScores = new Set(scores).size;

      console.log('\n======================================================');
      console.log('SCORE DISTRIBUTION SUMMARY');
      console.log('======================================================');
      console.log(`Total Bots Submitted: ${outcomes.length}`);
      console.log(`Passed / Qualified:   ${passedCount} (${((passedCount / Math.max(1, outcomes.length)) * 100).toFixed(1)}%)`);
      console.log(`Highest Score:        ${maxScore} / ${outcomes[0]?.totalMarks ?? 0}`);
      console.log(`Average Score:        ${avgScore} / ${outcomes[0]?.totalMarks ?? 0}`);
      console.log(`Lowest Score:         ${minScore} / ${outcomes[0]?.totalMarks ?? 0}`);
      console.log(`Distinct Score Tiers: ${uniqueScores} different score outcomes`);

      console.log('\nSample Leaderboard (Top 10 & Bottom 5 Bots):');
      const sampleRows = [
        ...outcomes.slice(0, 10),
        ...(outcomes.length > 15 ? outcomes.slice(-5) : []),
      ].map((o, idx) => ({
        Rank: idx < 10 ? idx + 1 : outcomes.length - (outcomes.slice(-5).length - (idx - 10)) + 1,
        Bot: `Bot #${o.botNo}`,
        Candidate: o.name,
        RollNo: o.rollNumber,
        College: o.college,
        Score: `${o.score} / ${o.totalMarks}`,
        Percentage: `${o.percentage}%`,
        Result: o.passed ? 'QUALIFIED' : 'NOT QUALIFIED',
        TabSwitches: o.tabSwitches,
      }));
      console.table(sampleRows);

      console.table([
        {
          'Concurrent Bots': customTier.concurrency,
          'Exam Code(s)': testCodes.join(', '),
          'Successful Submissions': customTier.successfulRequests,
          'Total HTTP Requests': customTier.totalRequests,
          'Duration (ms)': customTier.durationMs,
          'Throughput (req/s)': customTier.throughputRps,
          'p50 (ms)': customTier.p50Ms,
          'p95 (ms)': customTier.p95Ms,
          'Error Rate': `${((customTier.failedRequests / customTier.concurrency) * 100).toFixed(2)}%`,
        },
      ]);
      process.exit(0);
    }

    console.log('Testing 100, 250, and 500 concurrent candidate examination sessions...\n');
    const { metrics: tier100 } = await runConcurrencyTier(100, testCodes, fullAssessmentMap);
    const { metrics: tier250 } = await runConcurrencyTier(250, testCodes, fullAssessmentMap);
    const { metrics: tier500 } = await runConcurrencyTier(500, testCodes, fullAssessmentMap);

    console.log('\n======================================================');
    console.log('SUMMARY OF ACTUAL BENCHMARK RESULTS');
    console.log('======================================================');
    console.table([
      {
        'Concurrent Candidates': 100,
        'Total HTTP Requests': tier100.totalRequests,
        'Duration (ms)': tier100.durationMs,
        'Throughput (req/s)': tier100.throughputRps,
        'p50 (ms)': tier100.p50Ms,
        'p95 (ms)': tier100.p95Ms,
        'p99 (ms)': tier100.p99Ms,
        'Max (ms)': tier100.maxMs,
        'Error Rate': `${((tier100.failedRequests / 100) * 100).toFixed(2)}%`,
      },
      {
        'Concurrent Candidates': 250,
        'Total HTTP Requests': tier250.totalRequests,
        'Duration (ms)': tier250.durationMs,
        'Throughput (req/s)': tier250.throughputRps,
        'p50 (ms)': tier250.p50Ms,
        'p95 (ms)': tier250.p95Ms,
        'p99 (ms)': tier250.p99Ms,
        'Max (ms)': tier250.maxMs,
        'Error Rate': `${((tier250.failedRequests / 250) * 100).toFixed(2)}%`,
      },
      {
        'Concurrent Candidates': 500,
        'Total HTTP Requests': tier500.totalRequests,
        'Duration (ms)': tier500.durationMs,
        'Throughput (req/s)': tier500.throughputRps,
        'p50 (ms)': tier500.p50Ms,
        'p95 (ms)': tier500.p95Ms,
        'p99 (ms)': tier500.p99Ms,
        'Max (ms)': tier500.maxMs,
        'Error Rate': `${((tier500.failedRequests / 500) * 100).toFixed(2)}%`,
      },
    ]);
    process.exit(0);
  } catch (err) {
    console.error('Benchmark execution error:', err);
    process.exit(1);
  }
}

main();
