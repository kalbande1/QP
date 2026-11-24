/**
 * ====================================================================
 * महाराष्ट्र पोलीस भरती सराव परीक्षा पोर्टल - परीक्षा इंजिन (Exam Engine)
 * High Performance, Secure, TCS/IBPS Pattern
 * ====================================================================
 */

// १. युजर व URL पॅरामीटर्स
const currentUser = Auth.getUser();
if (!currentUser) {
    window.location.href = 'login.html';
}

const urlParams = new URLSearchParams(window.location.search);
const paperId = urlParams.get('paper_id');
const isPreview = urlParams.get('preview') === 'true';

if (!paperId) {
    alert("अवैध पेपर आयडी.");
    window.location.href = 'dashboard.html';
}

// परीक्षा जागतिक स्टेट
let paper = null;
let questions = [];
let currentIndex = 0;
let answers = {}; // { [questionId]: 'A' | 'B' | 'C' | 'D' }
let statusMap = {}; // { [questionId]: 'answered' | 'not-answered' | 'marked-review' | 'answered-review' | 'not-visited' }
let timeRemainingSeconds = 90 * 60;
let totalDurationSeconds = 90 * 60;
let timerInterval = null;
let activeSubjectFilter = 'all';

const STORAGE_SESSION_KEY = `pyq_exam_session_${paperId}_${currentUser.id}`;

// २. इनिशियलायझेशन
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('examCandidateName').textContent = `उमेदवार: ${currentUser.full_name} (${currentUser.bharti_type || 'पोलीस भरती'})`;

    await loadExamData();
    setupSubjectTabs();
    restoreOrInitSession();
    renderCurrentQuestion();
    renderPalette();
    startTimer();
});

// ३. पेपर व प्रश्न लोड करणे (सुरक्षित: बरोबर उत्तरे लपवलेली असतात)
async function loadExamData() {
    try {
        paper = await DB.getPaperById(paperId);
        if (!paper) {
            alert("हा पेपर सापडला नाही.");
            window.location.href = 'dashboard.html';
            return;
        }

        document.getElementById('examPaperTitle').textContent = paper.title;

        // सुरक्षित API कॉल: hideCorrectAnswer = true
        questions = await DB.getQuestionsForPaper(paperId, true);

        if (questions.length === 0) {
            alert("या पेपरमध्ये अजून कोणतेही प्रश्न उपलब्ध नाहीत.");
            window.location.href = 'dashboard.html';
            return;
        }

        totalDurationSeconds = (paper.time_minutes || 90) * 60;
        timeRemainingSeconds = totalDurationSeconds;

    } catch (err) {
        console.error("परीक्षा लोड त्रुटी:", err);
        alert("परीक्षा लोड करताना अडचण आली.");
    }
}

// ४. सेशन रिस्टोर किंवा इनिशियलाईझ
function restoreOrInitSession() {
    const saved = localStorage.getItem(STORAGE_SESSION_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            answers = data.answers || {};
            statusMap = data.statusMap || {};
            currentIndex = data.currentIndex || 0;
            if (data.timeRemainingSeconds && data.timeRemainingSeconds > 0) {
                timeRemainingSeconds = data.timeRemainingSeconds;
            }
        } catch (e) {
            console.error("सेशन रिस्टोर त्रुटी:", e);
        }
    }

    // डीफॉल्ट स्टेट इनिशियलाईझ
    questions.forEach((q, idx) => {
        if (!statusMap[q.id]) {
            statusMap[q.id] = (idx === currentIndex) ? 'not-answered' : 'not-visited';
        }
    });

    saveSessionProgress();
}

function saveSessionProgress() {
    const sessionData = {
        answers,
        statusMap,
        currentIndex,
        timeRemainingSeconds,
        totalDurationSeconds
    };
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
}

// ५. काउंटडाऊन टाइमर
function startTimer() {
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemainingSeconds--;
        updateTimerDisplay();

        // दर ५ सेकंदांनी प्रगती सेव्ह
        if (timeRemainingSeconds % 5 === 0) {
            saveSessionProgress();
        }

        // वेळ संपली
        if (timeRemainingSeconds <= 0) {
            clearInterval(timerInterval);
            timeRemainingSeconds = 0;
            updateTimerDisplay();
            autoSubmitExam();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemainingSeconds / 60);
    const seconds = timeRemainingSeconds % 60;

    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const timerElem = document.getElementById('examTimer');
    const timerBox = document.getElementById('timerContainer');

    if (timerElem) timerElem.textContent = formatted;

    // ५ मिनिटांपेक्षा कमी राहिल्यास लाल चेतावणी
    if (timeRemainingSeconds < 300) {
        if (timerBox) {
            timerBox.className = "flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-red-950/90 border border-red-700 text-red-300 shadow-inner animate-pulse";
        }
        if (timerElem) timerElem.className = "font-mono font-extrabold text-base sm:text-lg text-red-400 leading-tight";
    }
}

// ६. विषयनिहाय टॅब्स सेटअप
function setupSubjectTabs() {
    const container = document.getElementById('subjectTabsContainer');
    if (!container) return;

    // युनिक विषय मिळवणे
    const subjects = ['all', ...new Set(questions.map(q => q.subject))];

    container.innerHTML = subjects.map(sub => {
        const title = (sub === 'all') ? 'सर्व प्रश्न (All)' : sub;
        const count = (sub === 'all') ? questions.length : questions.filter(q => q.subject === sub).length;

        return `
            <button 
                onclick="setSubjectFilter('${sub}')" 
                id="subTab-${sub.replace(/\s+/g, '_')}" 
                class="sub-tab-btn px-3 py-1 rounded-lg text-xs font-semibold ${sub === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800'}"
            >
                ${escapeHtml(title)} (${count})
            </button>
        `;
    }).join('');
}

function setSubjectFilter(subject) {
    activeSubjectFilter = subject;

    // टॅब स्टाइल अपडेट
    const buttons = document.querySelectorAll('.sub-tab-btn');
    buttons.forEach(btn => {
        btn.className = "sub-tab-btn px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800";
    });

    const activeBtn = document.getElementById(`subTab-${subject.replace(/\s+/g, '_')}`);
    if (activeBtn) {
        activeBtn.className = "sub-tab-btn px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950";
    }

    // जर सध्याचा प्रश्न निवडलेल्या विषयात नसेल, तर त्या विषयाच्या पहिल्या प्रश्नावर उडी मारा
    if (subject !== 'all') {
        const firstIdx = questions.findIndex(q => q.subject === subject);
        if (firstIdx !== -1) {
            jumpToQuestion(firstIdx);
        }
    }
}

// ७. सध्याचा प्रश्न रेंडर करणे
function renderCurrentQuestion() {
    const q = questions[currentIndex];
    if (!q) return;

    // बॅजेस
    document.getElementById('currentQNumberBadge').textContent = `प्रश्न ${currentIndex + 1} / ${questions.length}`;
    document.getElementById('currentQSubjectBadge').textContent = `विषय: ${q.subject}`;

    // प्रश्न मजकूर
    document.getElementById('questionText').textContent = q.question_text;

    // इमेज
    const imgContainer = document.getElementById('questionImageContainer');
    const imgElem = document.getElementById('questionImage');
    if (q.image_url) {
        imgElem.src = q.image_url;
        imgContainer.classList.remove('hidden');
    } else {
        imgContainer.classList.add('hidden');
    }

    // पर्याय A, B, C, D
    const optionsContainer = document.getElementById('optionsContainer');
    const selectedOpt = answers[q.id] || null;

    const opts = [
        { key: 'A', text: q.option_a, marathiLabel: 'अ' },
        { key: 'B', text: q.option_b, marathiLabel: 'ब' },
        { key: 'C', text: q.option_c, marathiLabel: 'क' },
        { key: 'D', text: q.option_d, marathiLabel: 'ड' }
    ];

    optionsContainer.innerHTML = opts.map(opt => `
        <div 
            onclick="selectOption('${q.id}', '${opt.key}')" 
            class="option-item flex items-center ${selectedOpt === opt.key ? 'selected' : ''}"
        >
            <span class="option-badge">${opt.marathiLabel}</span>
            <span class="text-sm font-medium text-slate-800 flex-grow leading-relaxed">${escapeHtml(opt.text)}</span>
            <input 
                type="radio" 
                name="currentOption" 
                value="${opt.key}" 
                ${selectedOpt === opt.key ? 'checked' : ''} 
                class="w-4 h-4 text-blue-600 focus:ring-blue-500 ml-2 pointer-events-none"
            >
        </div>
    `).join('');

    // मागील / पुढील बटनांची स्थिती
    document.getElementById('prevBtn').disabled = (currentIndex === 0);

    const saveNextBtn = document.getElementById('saveNextBtn');
    if (currentIndex === questions.length - 1) {
        saveNextBtn.innerHTML = '<span>जतन करा व समाप्त</span> <i class="fa-solid fa-flag-checkered ml-1.5"></i>';
    } else {
        saveNextBtn.innerHTML = '<span>जतन करा आणि पुढील</span> <i class="fa-solid fa-chevron-right ml-1.5"></i>';
    }

    // स्टेटस अपडेट: जर पहिल्यांदाच पाहिला असेल तर 'not-answered' करा
    if (statusMap[q.id] === 'not-visited') {
        statusMap[q.id] = 'not-answered';
    }

    renderPalette();
    saveSessionProgress();
}

// ८. पर्याय निवडणे
function selectOption(questionId, optionKey) {
    answers[questionId] = optionKey;

    // जर आधी marked-review असेल तर answered-review करा, नाहीतर answered
    if (statusMap[questionId] === 'marked-review') {
        statusMap[questionId] = 'answered-review';
    } else {
        statusMap[questionId] = 'answered';
    }

    renderCurrentQuestion();
    renderPalette();
    saveSessionProgress();
}

// ९. निवड काढणे (Clear Selection)
function clearCurrentSelection() {
    const q = questions[currentIndex];
    if (!q) return;

    delete answers[q.id];

    if (statusMap[q.id] === 'answered-review') {
        statusMap[q.id] = 'marked-review';
    } else {
        statusMap[q.id] = 'not-answered';
    }

    renderCurrentQuestion();
    renderPalette();
    saveSessionProgress();
}

// १०. जतन करा आणि पुढील (Save & Next)
function saveAndNext() {
    const q = questions[currentIndex];
    if (q) {
        if (answers[q.id]) {
            if (statusMap[q.id] !== 'answered-review') {
                statusMap[q.id] = 'answered';
            }
        } else {
            if (statusMap[q.id] !== 'marked-review') {
                statusMap[q.id] = 'not-answered';
            }
        }
    }

    if (currentIndex < questions.length - 1) {
        currentIndex++;
        renderCurrentQuestion();
    } else {
        confirmSubmitExam();
    }
}

// ११. नंतर तपासा आणि पुढील (Mark for Review & Next)
function markForReviewAndNext() {
    const q = questions[currentIndex];
    if (q) {
        if (answers[q.id]) {
            statusMap[q.id] = 'answered-review';
        } else {
            statusMap[q.id] = 'marked-review';
        }
    }

    if (currentIndex < questions.length - 1) {
        currentIndex++;
    }
    renderCurrentQuestion();
}

// १२. मागील प्रश्न (Previous)
function prevQuestion() {
    if (currentIndex > 0) {
        currentIndex--;
        renderCurrentQuestion();
    }
}

// १३. थेट प्रश्नावर उडी मारणे (Jump via Palette)
function jumpToQuestion(index) {
    if (index >= 0 && index < questions.length) {
        currentIndex = index;
        renderCurrentQuestion();
    }
}

// १४. प्रश्न पॅलेट रेंडर करणे (Palette Grid & Counts)
function renderPalette() {
    const grid = document.getElementById('paletteGrid');
    if (!grid) return;

    let countAns = 0;
    let countNotAns = 0;
    let countReview = 0;
    let countNotVisited = 0;

    grid.innerHTML = questions.map((q, idx) => {
        const status = statusMap[q.id] || 'not-visited';
        const isCurrent = (idx === currentIndex);

        // आकडे मोजणे
        if (status === 'answered' || status === 'answered-review') countAns++;
        if (status === 'not-answered') countNotAns++;
        if (status === 'marked-review' || status === 'answered-review') countReview++;
        if (status === 'not-visited') countNotVisited++;

        return `
            <button 
                onclick="jumpToQuestion(${idx})" 
                title="प्रश्न क्र. ${idx + 1} (${q.subject})"
                class="palette-btn ${status} ${isCurrent ? 'current' : ''}"
            >
                ${idx + 1}
            </button>
        `;
    }).join('');

    // सारांश अपडेट
    document.getElementById('paletteCountSummary').textContent = `${countAns} / ${questions.length} सोडवले`;
    document.getElementById('countAnswered').textContent = countAns;
    document.getElementById('countNotAnswered').textContent = countNotAns;
    document.getElementById('countMarkedReview').textContent = countReview;
    document.getElementById('countNotVisited').textContent = countNotVisited;
}

// १५. सबमिट मोडल उघडणे
function confirmSubmitExam() {
    let answered = 0;
    let review = 0;

    questions.forEach(q => {
        if (answers[q.id]) answered++;
        if (statusMap[q.id] === 'marked-review' || statusMap[q.id] === 'answered-review') review++;
    });

    const unattempted = questions.length - answered;

    document.getElementById('modalTotalQ').textContent = questions.length;
    document.getElementById('modalAnsweredQ').textContent = answered;
    document.getElementById('modalUnattemptedQ').textContent = unattempted;
    document.getElementById('modalReviewQ').textContent = review;

    document.getElementById('submitConfirmModal').classList.remove('hidden');
}

function closeSubmitModal() {
    document.getElementById('submitConfirmModal').classList.add('hidden');
}

// १६. अंतिम सबमिशन प्रक्रिया (Perform Final Submission)
async function performFinalSubmission() {
    const finalBtn = document.getElementById('finalSubmitBtn');
    finalBtn.disabled = true;
    finalBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> मार्किंग सुरू आहे...';

    clearInterval(timerInterval);

    const timeTakenSeconds = Math.max(1, totalDurationSeconds - timeRemainingSeconds);

    try {
        const res = await DB.submitExamAttempt(
            currentUser.id,
            paperId,
            answers,
            timeTakenSeconds
        );

        if (res.success) {
            // स्थानिक सेशन प्रगती स्वच्छ करणे
            localStorage.removeItem(STORAGE_SESSION_KEY);

            Swal.fire({
                icon: 'success',
                title: 'पेपर यशस्वीरित्या सबमिट झाला!',
                text: 'तुमचा निकाल आणि विषयनिहाय गुण विश्लेषण तयार केले आहे.',
                confirmButtonColor: '#10b981',
                confirmButtonText: 'निकालाचे विश्लेषण पहा',
                allowOutsideClick: false
            }).then(() => {
                window.location.href = `report.html?attempt_id=${res.attempt.id}`;
            });
        } else {
            throw new Error(res.message || "सबमिशन त्रुटी");
        }
    } catch (err) {
        console.error(err);
        Swal.fire({
            icon: 'error',
            title: 'सबमिशन त्रुटी',
            text: 'पेपर सबमिट करताना अडचण आली. कृपया पुन्हा प्रयत्न करा.',
            confirmButtonColor: '#dc2626'
        });
        finalBtn.disabled = false;
        finalBtn.innerHTML = 'होय, सबमिट करा';
    }
}

// १७. वेळ संपल्यावर ऑटो-सबमिट
function autoSubmitExam() {
    Swal.fire({
        icon: 'info',
        title: 'परीक्षा वेळ समाप्त!',
        text: 'तुमची ९० मिनिटांची वेळ संपली आहे. पेपर स्वयंचलितरीत्या सबमिट केला जात आहे...',
        showConfirmButton: false,
        timer: 2000,
        allowOutsideClick: false
    }).then(() => {
        performFinalSubmission();
    });
}

// १८. मोठी प्रतिमा पाहणे (Image Zoom)
function viewLargeImage(src) {
    document.getElementById('largeImageSrc').src = src;
    document.getElementById('imageViewerModal').classList.remove('hidden');
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
