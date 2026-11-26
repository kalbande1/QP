/**
 * ====================================================================
 * महाराष्ट्र पोलीस भरती सराव परीक्षा पोर्टल - ॲडमिन पॅनेल स्क्रिप्ट
 * Admin Dashboard & Management Logic
 * ====================================================================
 */

// १. ॲडमिन ऑथेंटिकेशन पडताळणी
let currentAdmin = null;
try {
    currentAdmin = Auth.protectPage('admin');
} catch (e) {
    console.error(e);
}

// जागतिक स्टेट व्हेरिएबल्स
let allStudents = [];
let allPapers = [];
let allQuestions = [];
let allFlags = [];
let studentFilterStatus = 'all';
let parsedCsvQuestions = [];

// DOM तयार झाल्यावर इनिशियलाईझ करणे
document.addEventListener('DOMContentLoaded', async () => {
    if (currentAdmin) {
        document.getElementById('adminName').textContent = currentAdmin.full_name || 'मुख्य प्रशासक';
    }

    updateDatabaseStatusBadge();
    await loadAllAdminData();
    switchTab('dashboard');
});

// २. डेटाबेस स्टेटस बॅज अपडेट करणे
function updateDatabaseStatusBadge() {
    const badge = document.getElementById('supabaseStatusBadge');
    if (window.isSupabaseActive) {
        badge.className = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800";
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span> Supabase सक्रिय';
    } else {
        badge.className = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-400 border border-amber-800";
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span> स्थानिक मोड (Local)';
    }
}

// ३. सर्व डेटा रीलोड करणे
async function loadAllAdminData() {
    try {
        const [stats, students, papers, questions, flags] = await Promise.all([
            DB.getDashboardStats(),
            DB.getAllStudents(),
            DB.getPapers(false),
            DB.getAllQuestions(),
            DB.getFlags()
        ]);

        allStudents = students;
        allPapers = papers;
        allQuestions = questions;
        allFlags = flags;

        // १. डॅशबोर्ड आकडेवारी
        document.getElementById('statTotalStudents').textContent = stats.total_students;
        document.getElementById('statPendingApprovals').textContent = stats.pending_approvals;
        document.getElementById('statTotalPapers').textContent = stats.total_papers;
        document.getElementById('statTotalAttempts').textContent = stats.total_attempts;
        document.getElementById('statPendingFlags').textContent = stats.pending_flags;

        // बॅज आकडेवारी
        const pendingBadge = document.getElementById('tabPendingBadge');
        if (stats.pending_approvals > 0) {
            pendingBadge.textContent = stats.pending_approvals;
            pendingBadge.classList.remove('hidden');
        } else {
            pendingBadge.classList.add('hidden');
        }

        const flagsBadge = document.getElementById('tabFlagsBadge');
        if (stats.pending_flags > 0) {
            flagsBadge.textContent = stats.pending_flags;
            flagsBadge.classList.remove('hidden');
        } else {
            flagsBadge.classList.add('hidden');
        }

        // २. सर्व सेक्शन्स रेंडर करणे
        renderRecentStudents();
        renderStudentsTable();
        renderPapersList();
        populatePaperSelectDropdowns();
        renderQuestionsList();
        renderFlagsTable();

    } catch (err) {
        console.error("डेटा लोड त्रुटी:", err);
    }
}

// ४. टॅब स्विचिंग (Tab Switching)
function switchTab(tabId) {
    const tabs = ['dashboard', 'students', 'papers', 'csvUpload', 'questions', 'flags'];
    tabs.forEach(t => {
        const content = document.getElementById(`tabContent-${t}`);
        const btn = document.getElementById(`tabBtn-${t}`);
        if (content) content.classList.add('hidden');
        if (btn) {
            btn.classList.remove('active', 'bg-slate-800', 'text-white');
            btn.classList.add('text-slate-400');
        }
    });

    const activeContent = document.getElementById(`tabContent-${tabId}`);
    const activeBtn = document.getElementById(`tabBtn-${tabId}`);
    if (activeContent) activeContent.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.classList.add('active', 'bg-slate-800', 'text-white');
        activeBtn.classList.remove('text-slate-400');
    }
}

// ====================================================================
// ५. विद्यार्थी व्यवस्थापन (Students & Approval Management)
// ====================================================================

function renderRecentStudents() {
    const tbody = document.getElementById('recentStudentsTable');
    if (!tbody) return;

    const students = allStudents.filter(s => s.role !== 'admin').slice(0, 5);
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">अजून कोणतेही विद्यार्थी नोंदणीकृत नाहीत.</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(s => `
        <tr class="hover:bg-slate-50 transition">
            <td class="p-3 font-semibold text-slate-900">${escapeHtml(s.full_name)}</td>
            <td class="p-3 font-mono font-medium">${escapeHtml(s.mobile)}</td>
            <td class="p-3">${escapeHtml(s.bharti_type || 'जिल्हा पोलीस')}</td>
            <td class="p-3 text-slate-400">${new Date(s.created_at).toLocaleDateString('mr-IN')}</td>
            <td class="p-3">${getStatusBadge(s.status, s.is_approved)}</td>
            <td class="p-3 text-right">
                ${s.status === 'pending' || !s.is_approved ? `
                    <button onclick="approveStudent('${s.id}')" class="px-2.5 py-1 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition">
                        मंजूर करा
                    </button>
                ` : `
                    <span class="text-xs text-slate-400">मंजूर आहे</span>
                `}
            </td>
        </tr>
    `).join('');
}

function setStudentFilter(status) {
    studentFilterStatus = status;
    const buttons = ['all', 'pending', 'approved', 'rejected', 'deactivated'];
    buttons.forEach(b => {
        const btn = document.getElementById(`filterBtn-${b}`);
        if (btn) {
            if (b === status) {
                btn.className = "px-3 py-1.5 rounded-md bg-slate-900 text-white";
            } else {
                btn.className = "px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200";
            }
        }
    });
    renderStudentsTable();
}

function renderStudentsTable() {
    const tbody = document.getElementById('fullStudentsTable');
    if (!tbody) return;

    const search = (document.getElementById('studentSearchInput')?.value || '').toLowerCase().trim();
    const studentsOnly = allStudents.filter(s => s.role !== 'admin');

    // प्रलंबित संख्या अपडेट
    const pendingCount = studentsOnly.filter(s => s.status === 'pending' || !s.is_approved).length;
    const countBadge = document.getElementById('countPendingFilter');
    if (countBadge) countBadge.textContent = pendingCount;

    // फिल्टर
    let filtered = studentsOnly;
    if (studentFilterStatus !== 'all') {
        if (studentFilterStatus === 'pending') {
            filtered = filtered.filter(s => s.status === 'pending' || !s.is_approved);
        } else {
            filtered = filtered.filter(s => s.status === studentFilterStatus);
        }
    }

    if (search) {
        filtered = filtered.filter(s => 
            s.full_name.toLowerCase().includes(search) || 
            s.mobile.includes(search) || 
            (s.email && s.email.toLowerCase().includes(search)) ||
            (s.bharti_type && s.bharti_type.toLowerCase().includes(search))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400">कोणताही विद्यार्थी सापडला नाही.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(s => `
        <tr class="hover:bg-slate-50 transition">
            <td class="p-3">
                <div class="font-bold text-slate-900">${escapeHtml(s.full_name)}</div>
            </td>
            <td class="p-3 font-mono font-medium">${escapeHtml(s.mobile)}</td>
            <td class="p-3 text-slate-500">${escapeHtml(s.email || '-')}</td>
            <td class="p-3 font-medium text-slate-700">${escapeHtml(s.bharti_type || 'जिल्हा पोलीस')}</td>
            <td class="p-3 text-slate-400">${new Date(s.created_at).toLocaleDateString('mr-IN')}</td>
            <td class="p-3">${getStatusBadge(s.status, s.is_approved)}</td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center space-x-1.5">
                    ${s.status !== 'approved' ? `
                        <button onclick="approveStudent('${s.id}')" title="अकाउंट मंजूर करा" class="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition">
                            <i class="fa-solid fa-check mr-1"></i> मंजूर
                        </button>
                    ` : ''}

                    ${s.status === 'pending' ? `
                        <button onclick="rejectStudent('${s.id}')" title="नोंदणी रद्द करा" class="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition">
                            <i class="fa-solid fa-xmark mr-1"></i> रद्द
                        </button>
                    ` : ''}

                    ${s.status === 'approved' ? `
                        <button onclick="toggleDeactivateStudent('${s.id}', 'deactivated')" title="खाते तात्पुरते बंद करा" class="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[11px] transition">
                            <i class="fa-solid fa-ban mr-1"></i> बंद करा
                        </button>
                    ` : ''}

                    ${s.status === 'deactivated' ? `
                        <button onclick="toggleDeactivateStudent('${s.id}', 'approved')" title="खाते पुन्हा सुरू करा" class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] transition">
                            <i class="fa-solid fa-rotate-left mr-1"></i> सुरू करा
                        </button>
                    ` : ''}

                    <button onclick="deleteStudent('${s.id}', '${escapeHtml(s.full_name)}')" title="डेटा हटवा" class="p-1 rounded text-slate-400 hover:text-rose-600 transition">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getStatusBadge(status, isApproved) {
    if (status === 'approved' && isApproved) {
        return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">मंजूर (Active)</span>';
    }
    if (status === 'rejected') {
        return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">रद्द (Rejected)</span>';
    }
    if (status === 'deactivated') {
        return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">बंद (Deactivated)</span>';
    }
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">मंजुरी प्रलंबित</span>';
}

async function approveStudent(studentId) {
    const res = await DB.updateStudentStatus(studentId, 'approved');
    if (res.success) {
        Swal.fire({
            icon: 'success',
            title: 'विद्यार्थी मंजूर झाला!',
            text: 'आता हा विद्यार्थी त्याच्या मोबाईल नंबर व पासवर्डने परीक्षा सोडवू शकतो.',
            timer: 1500,
            showConfirmButton: false
        });
        await loadAllAdminData();
    }
}

async function rejectStudent(studentId) {
    Swal.fire({
        title: 'नोंदणी रद्द करायची आहे का?',
        text: 'या विद्यार्थ्याला परीक्षेत प्रवेश नाकारला जाईल.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'होय, रद्द करा',
        cancelButtonText: 'मागे घ्या'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await DB.updateStudentStatus(studentId, 'rejected');
            await loadAllAdminData();
            Swal.fire('रद्द झाले!', 'नोंदणी रद्द करण्यात आली आहे.', 'success');
        }
    });
}

async function toggleDeactivateStudent(studentId, newStatus) {
    await DB.updateStudentStatus(studentId, newStatus);
    await loadAllAdminData();
}

async function deleteStudent(studentId, name) {
    Swal.fire({
        title: 'विद्यार्थी हटवायचा आहे का?',
        text: `${name} ची संपूर्ण माहिती व निकालाचा डेटा कायमचा हटवला जाईल.`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'होय, हटवा',
        cancelButtonText: 'रद्द करा'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await DB.deleteStudent(studentId);
            await loadAllAdminData();
            Swal.fire('हटवले!', 'विद्यार्थी यशस्वीरित्या हटवला गेला आहे.', 'success');
        }
    });
}

// ====================================================================
// ६. पेपर्स व्यवस्थापन (Papers Management)
// ====================================================================

function renderPapersList() {
    const container = document.getElementById('papersListContainer');
    if (!container) return;

    if (allPapers.length === 0) {
        container.innerHTML = `
            <div class="col-span-2 p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <i class="fa-solid fa-file-circle-plus text-4xl text-slate-400 mb-3"></i>
                <h3 class="text-sm font-bold text-slate-700">अजून कोणताही सराव पेपर तयार केलेला नाही.</h3>
                <p class="text-xs text-slate-500 mt-1 mb-4">पहिला पेपर तयार करण्यासाठी खालील बटनावर क्लिक करा.</p>
                <button onclick="openPaperModal()" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold text-xs">
                    + नवीन पेपर तयार करा
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = allPapers.map(paper => {
        const subCounts = paper.subjects_count || {};
        return `
            <div class="police-card p-6 bg-white flex flex-col justify-between border-t-4 ${paper.is_published ? 'border-t-emerald-500' : 'border-t-slate-400'}">
                <div>
                    <!-- वरचा स्टेटस बॅज -->
                    <div class="flex items-center justify-between mb-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${paper.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}">
                            <span class="w-2 h-2 rounded-full mr-1.5 ${paper.is_published ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                            ${paper.is_published ? 'पब्लिश (विद्यार्थ्यांना उपलब्ध)' : 'लपवला (Draft/Hidden)'}
                        </span>

                        <div class="flex items-center space-x-1">
                            <button onclick="togglePublishPaper('${paper.id}')" title="${paper.is_published ? 'विद्यार्थ्यांपासून लपवा' : 'पब्लिश करा'}" class="p-1.5 text-xs rounded hover:bg-slate-100 text-slate-600">
                                <i class="fa-solid ${paper.is_published ? 'fa-eye-slash text-amber-600' : 'fa-eye text-emerald-600'}"></i>
                            </button>
                            <button onclick="editPaper('${paper.id}')" title="पेपर सेटिंग्ज बदला" class="p-1.5 text-xs rounded hover:bg-slate-100 text-blue-600">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="deletePaper('${paper.id}', '${escapeHtml(paper.title)}')" title="पेपर हटवा" class="p-1.5 text-xs rounded hover:bg-slate-100 text-rose-600">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>

                    <!-- शीर्षक व माहिती -->
                    <h3 class="text-base font-extrabold text-slate-900 leading-snug">${escapeHtml(paper.title)}</h3>
                    <p class="text-xs text-slate-500 mt-1 line-clamp-2">${escapeHtml(paper.description || 'मराठी, गणित, बुद्धिमत्ता व चालू घडामोडी सराव संच.')}</p>

                    <!-- बेसिक माहिती चिप्स -->
                    <div class="flex flex-wrap gap-2 mt-4 text-xs">
                        <span class="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold flex items-center">
                            <i class="fa-regular fa-clock mr-1 text-blue-600"></i> ${paper.time_minutes} मिनिटे
                        </span>
                        <span class="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold flex items-center">
                            <i class="fa-solid fa-list-ol mr-1 text-emerald-600"></i> ${paper.total_questions || 0} प्रश्न
                        </span>
                        <span class="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold flex items-center">
                            <i class="fa-solid fa-award mr-1 text-amber-600"></i> ${paper.total_marks} गुण
                        </span>
                    </div>

                    <!-- विषयनिहाय प्रश्न विभागणी -->
                    <div class="mt-4 pt-3 border-t border-slate-100 text-[11px] grid grid-cols-2 gap-1 text-slate-600">
                        <div>मराठी व्याकरण: <b>${subCounts['मराठी व्याकरण'] || 0}</b></div>
                        <div>अंकगणित: <b>${subCounts['अंकगणित'] || 0}</b></div>
                        <div>बुद्धिमत्ता चाचणी: <b>${subCounts['बुद्धिमत्ता चाचणी'] || 0}</b></div>
                        <div>चालू घडामोडी: <b>${subCounts['सामान्य ज्ञान व चालू घडामोडी'] || 0}</b></div>
                    </div>
                </div>

                <!-- कृती बटने -->
                <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button onclick="goToPaperQuestions('${paper.id}')" class="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition flex items-center">
                        <i class="fa-solid fa-circle-question mr-1.5"></i> प्रश्न व्यवस्थापित करा
                    </button>
                    <a href="exam.html?paper_id=${paper.id}&preview=true" target="_blank" class="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition flex items-center">
                        <i class="fa-solid fa-arrow-up-right-from-square mr-1.5"></i> विद्यार्थी व्ह्यू
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

// पेपर मोडल उघडणे
function openPaperModal(paper = null) {
    const modal = document.getElementById('paperModal');
    const title = document.getElementById('paperModalTitle');
    const form = document.getElementById('paperForm');

    form.reset();
    if (paper) {
        title.textContent = 'पेपर संपादन करा';
        document.getElementById('paperFormId').value = paper.id;
        document.getElementById('paperTitle').value = paper.title;
        document.getElementById('paperDescription').value = paper.description || '';
        document.getElementById('paperTime').value = paper.time_minutes;
        document.getElementById('paperMarks').value = paper.total_marks;
        document.getElementById('paperAllowRetake').checked = Boolean(paper.allow_retake);
        document.getElementById('paperShuffle').checked = Boolean(paper.shuffle_questions);
        document.getElementById('paperLeaderboard').checked = Boolean(paper.show_leaderboard);
        document.getElementById('paperPublish').checked = Boolean(paper.is_published);
    } else {
        title.textContent = 'नवीन पेपर तयार करा';
        document.getElementById('paperFormId').value = '';
        document.getElementById('paperTime').value = 90;
        document.getElementById('paperMarks').value = 100;
        document.getElementById('paperAllowRetake').checked = true;
        document.getElementById('paperShuffle').checked = true;
        document.getElementById('paperLeaderboard').checked = true;
        document.getElementById('paperPublish').checked = true;
    }

    modal.classList.remove('hidden');
}

function closePaperModal() {
    document.getElementById('paperModal').classList.add('hidden');
}

function editPaper(paperId) {
    const paper = allPapers.find(p => p.id === paperId);
    if (paper) openPaperModal(paper);
}

// पेपर सेव्ह करणे
document.getElementById('paperForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const paperData = {
        id: document.getElementById('paperFormId').value || undefined,
        title: document.getElementById('paperTitle').value,
        description: document.getElementById('paperDescription').value,
        time_minutes: document.getElementById('paperTime').value,
        total_marks: document.getElementById('paperMarks').value,
        allow_retake: document.getElementById('paperAllowRetake').checked,
        shuffle_questions: document.getElementById('paperShuffle').checked,
        show_leaderboard: document.getElementById('paperLeaderboard').checked,
        is_published: document.getElementById('paperPublish').checked
    };

    const res = await DB.savePaper(paperData);
    if (res.success) {
        closePaperModal();
        Swal.fire({
            icon: 'success',
            title: 'पेपर जतन झाला!',
            timer: 1200,
            showConfirmButton: false
        });
        await loadAllAdminData();
    }
});

// पेपर पब्लिश / लपवा टॉगल
async function togglePublishPaper(paperId) {
    const paper = allPapers.find(p => p.id === paperId);
    if (!paper) return;

    await DB.savePaper({
        ...paper,
        is_published: !paper.is_published
    });
    await loadAllAdminData();
}

// पेपर डिलीट करणे
async function deletePaper(paperId, title) {
    Swal.fire({
        title: 'पेपर हटवायचा आहे का?',
        text: `"${title}" हा पेपर आणि त्यातील सर्व प्रश्न व विद्यार्थ्यांचे सोडवलेले निकाल कायमचे हटवले जातील!`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'होय, पेपर हटवा',
        cancelButtonText: 'रद्द करा'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await DB.deletePaper(paperId);
            await loadAllAdminData();
            Swal.fire('हटवले!', 'पेपर यशस्वीरित्या हटवण्यात आला आहे.', 'success');
        }
    });
}

function goToPaperQuestions(paperId) {
    const filterSelect = document.getElementById('filterQuestionPaperSelect');
    if (filterSelect) filterSelect.value = paperId;
    switchTab('questions');
    renderQuestionsList();
}

// ====================================================================
// ७. CSV प्रश्न अपलोड व नमुना फाईल डाऊनलोड (CSV Upload & Parser)
// ====================================================================

function populatePaperSelectDropdowns() {
    const csvSelect = document.getElementById('csvTargetPaperSelect');
    const filterSelect = document.getElementById('filterQuestionPaperSelect');
    const qFormSelect = document.getElementById('qFormPaper');

    const options = allPapers.map(p => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');

    if (csvSelect) csvSelect.innerHTML = options;
    if (filterSelect) filterSelect.innerHTML = options;
    if (qFormSelect) qFormSelect.innerHTML = options;
}

// नमुना CSV टेम्प्लेट डाउनलोड (UTF-8 with BOM)
function downloadSampleCSV() {
    // UTF-8 BOM: \uFEFF जेणेकरून Excel मध्ये मराठी अक्षरे थेट योग्य दिसतात
    const bom = '\uFEFF';
    const csvHeader = 'subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,image_url\r\n';
    const sampleRows = [
        '"मराठी व्याकरण","खालीलपैकी कोणता स्वर ""संयुक्त स्वर"" नाही?","ए","ऐ","ओ","ई","D","ई हा दीर्घ स्वर आहे; ए, ऐ, ओ, औ हे संयुक्त स्वर आहेत.",""',
        '"मराठी व्याकरण","""वाघाने गाय मारली"" या वाक्यातील प्रयोग ओळखा.","कर्तरी प्रयोग","कर्मणी प्रयोग","भावे प्रयोग","संकीर्ण प्रयोग","C","कर्त्याला व कर्माला दोघांनाही प्रत्यय लागल्यामुळे हा भावे प्रयोग आहे.",""',
        '"अंकगणित","१ ते ५० मधील एकूण मूळ संख्या (Prime Numbers) किती आहेत?","१२","१५","१८","२०","B","१ ते ५० दरम्यान एकूण १५ मूळ संख्या आहेत.",""',
        '"अंकगणित","दोन संख्यांचे गुणोत्तर ३:५ असून बेरीज २४० आहे, तर मोठी संख्या कोणती?","९०","१२०","१५०","१६०","C","३x + ५x = २४० => x = ३०. मोठी संख्या = ५ * ३० = १५०.",""',
        '"बुद्धिमत्ता चाचणी","संख्या मालिका पूर्ण करा: ४, ९, १६, २५, ३६, ?","४५","४९","५४","६४","B","ही २, ३, ४, ५, ६ यांच्या वर्गांची मालिका आहे. पुढील वर्ग ७ चा वर्ग = ४९.",""',
        '"बुद्धिमत्ता चाचणी","जर CAT = 24 आणि DOG = 26, तर POLICE = ?","६०","६५","७०","७५","A","अक्षरांच्या अनुक्रमांकांची बेरीज: १६ + १५ + १२ + ९ + ३ + ५ = ६०.",""',
        '"सामान्य ज्ञान व चालू घडामोडी","महाराष्ट्र पोलीस दलाचे ब्रीदवाक्य कोणते आहे?","सेवा परमो धर्म:","सद्रक्षणाय खलनिग्रहणाय","सत्यमेव जयते","जय हिंद","B","""सद्रक्षणाय खलनिग्रहणाय"" हे महाराष्ट्र पोलिसांचे ब्रीदवाक्य आहे.",""',
        '"सामान्य ज्ञान व चालू घडामोडी","महाराष्ट्र पोलीस दलाचे मुख्यालय कोठे आहे?","पुणे","नागपूर","मुंबई","नाशिक","C","महाराष्ट्र पोलीस मुख्यालयाची मुख्य इमारत कुलाबा, मुंबई येथे आहे.",""'
    ].join('\r\n');

    const fullCsv = bom + csvHeader + sampleRows;
    const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'पोलीस_भरती_मराठी_प्रश्न_टेम्प्लेट_UTF8.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// नवीन पेपर vs विद्यमान पेपर मोड टॉगल करणे
function togglePaperUploadMode() {
    const mode = document.querySelector('input[name="paperUploadMode"]:checked')?.value || 'existing';
    const existingGroup = document.getElementById('existingPaperGroup');
    const newGroup = document.getElementById('newPaperGroup');
    if (mode === 'new') {
        if (existingGroup) existingGroup.classList.add('hidden');
        if (newGroup) newGroup.classList.remove('hidden');
    } else {
        if (existingGroup) existingGroup.classList.remove('hidden');
        if (newGroup) newGroup.classList.add('hidden');
    }
}

// CSV फाईल वाचणे व पार्स करणे (UTF-8 Unicode Safe)
function handleParseCSV() {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        Swal.fire('फाईल निवडा', 'कृपया प्रथम मराठी प्रश्नांची CSV फाईल निवडा.', 'warning');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        let text = e.target.result;
        // BOM काढणे
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.substr(1);
        }

        parsedCsvQuestions = parseCSVText(text);

        if (parsedCsvQuestions.length === 0) {
            Swal.fire('त्रुटी', 'CSV फाईलमधून एकही वैध प्रश्न सापडला नाही. कृपया नमुना टेम्प्लेटनुसार कॉलम तपासा.', 'error');
            return;
        }

        // पूर्वावलोकन दाखवणे
        const previewSection = document.getElementById('csvPreviewSection');
        const previewCount = document.getElementById('previewCount');

        if (previewCount) previewCount.textContent = parsedCsvQuestions.length;
        renderCsvPreviewTable();

        if (previewSection) {
            previewSection.classList.remove('hidden');
            previewSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    reader.readAsText(file, 'UTF-8');
}

// CSV पूर्वावलोकन टेबल रेंडर करणे (इमेज अपलोड पर्यायासह)
function renderCsvPreviewTable() {
    const previewTbody = document.getElementById('csvPreviewTableBody');
    if (!previewTbody) return;

    previewTbody.innerHTML = parsedCsvQuestions.map((q, idx) => `
        <tr class="hover:bg-slate-50">
            <td class="p-2 font-bold">${idx + 1}</td>
            <td class="p-2"><span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-semibold">${escapeHtml(q.subject)}</span></td>
            <td class="p-2 font-medium max-w-xs truncate" title="${escapeHtml(q.question_text)}">${escapeHtml(q.question_text)}</td>
            <td class="p-2 text-center">
                ${q.image_url ? `
                    <div class="flex items-center justify-center space-x-1">
                        <img src="${q.image_url}" class="w-8 h-8 rounded border object-contain shadow-xs" title="इमेज संलग्न">
                        <button type="button" onclick="removePreviewImage(${idx})" class="text-rose-500 hover:text-rose-700 text-xs" title="इमेज काढा"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                ` : `
                    <label class="px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 cursor-pointer font-bold text-[10px] inline-flex items-center">
                        <i class="fa-solid fa-camera mr-1"></i> इमेज जोडा
                        <input type="file" accept="image/*" class="hidden" onchange="attachImageToPreviewRow(${idx}, this)">
                    </label>
                `}
            </td>
            <td class="p-2 truncate max-w-xs">${escapeHtml(q.option_a)}</td>
            <td class="p-2 truncate max-w-xs">${escapeHtml(q.option_b)}</td>
            <td class="p-2 truncate max-w-xs">${escapeHtml(q.option_c)}</td>
            <td class="p-2 truncate max-w-xs">${escapeHtml(q.option_d)}</td>
            <td class="p-2 text-center font-bold text-emerald-700">${escapeHtml(q.correct_option)}</td>
        </tr>
    `).join('');
}

// पूर्वावलोकनातील प्रश्नाला थेट इमेज जोडणे
async function attachImageToPreviewRow(index, input) {
    if (!input.files || !input.files[0]) return;
    try {
        const compressed = await compressImageToDataUrl(input.files[0]);
        parsedCsvQuestions[index].image_url = compressed.dataUrl;
        renderCsvPreviewTable();
    } catch (e) {
        Swal.fire('त्रुटी', 'इमेज कॉम्प्रेस करताना अडचण आली.', 'error');
    }
}

function removePreviewImage(index) {
    parsedCsvQuestions[index].image_url = '';
    renderCsvPreviewTable();
}

// सुरक्षित CSV पार्सर (Commas inside quotes & newlines)
function parseCSVText(csvString) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < csvString.length; i++) {
        const char = csvString[i];
        const nextChar = csvString[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++; // Skip escaped quote
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++; // Skip \r\n
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c.length > 0)) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
            rows.push(currentRow);
        }
    }

    if (rows.length < 2) return [];

    // हेडर्स मॅपिंग
    const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const subjectIdx = headers.indexOf('subject');
    const qTextIdx = headers.indexOf('question_text') !== -1 ? headers.indexOf('question_text') : headers.indexOf('question');
    const optAIdx = headers.indexOf('option_a') !== -1 ? headers.indexOf('option_a') : headers.indexOf('a');
    const optBIdx = headers.indexOf('option_b') !== -1 ? headers.indexOf('option_b') : headers.indexOf('b');
    const optCIdx = headers.indexOf('option_c') !== -1 ? headers.indexOf('option_c') : headers.indexOf('c');
    const optDIdx = headers.indexOf('option_d') !== -1 ? headers.indexOf('option_d') : headers.indexOf('d');
    const correctIdx = headers.indexOf('correct_option') !== -1 ? headers.indexOf('correct_option') : headers.indexOf('answer');
    const expIdx = headers.indexOf('explanation');
    const imgIdx = headers.indexOf('image_url');

    const result = [];
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const qText = qTextIdx !== -1 && row[qTextIdx] ? row[qTextIdx] : '';
        if (!qText) continue;

        result.push({
            subject: (subjectIdx !== -1 && row[subjectIdx]) ? row[subjectIdx] : 'सामान्य ज्ञान व चालू घडामोडी',
            question_text: qText,
            option_a: optAIdx !== -1 && row[optAIdx] ? row[optAIdx] : 'पर्याय अ',
            option_b: optBIdx !== -1 && row[optBIdx] ? row[optBIdx] : 'पर्याय ब',
            option_c: optCIdx !== -1 && row[optCIdx] ? row[optCIdx] : 'पर्याय क',
            option_d: optDIdx !== -1 && row[optDIdx] ? row[optDIdx] : 'पर्याय ड',
            correct_option: (correctIdx !== -1 && row[correctIdx]) ? row[correctIdx].toUpperCase().trim() : 'A',
            explanation: expIdx !== -1 && row[expIdx] ? row[expIdx] : '',
            image_url: imgIdx !== -1 && row[imgIdx] ? row[imgIdx] : ''
        });
    }

    return result;
}

// पार्स केलेले प्रश्न डेटाबेसमध्ये सेव्ह करणे व विद्यार्थ्यांसाठी आपोआप पब्लिश करणे
async function commitCsvQuestions() {
    const uploadMode = document.querySelector('input[name="paperUploadMode"]:checked')?.value || 'existing';
    let targetPaperId = '';

    if (uploadMode === 'new') {
        const newTitle = document.getElementById('csvNewPaperTitle')?.value.trim();
        const newTime = document.getElementById('csvNewPaperTime')?.value || 90;
        const newMarks = document.getElementById('csvNewPaperMarks')?.value || 100;

        if (!newTitle) {
            Swal.fire('पेपरचे नाव टाका', 'कृपया नवीन पेपरचे नाव प्रविष्ट करा.', 'warning');
            return;
        }

        // नवीन पेपर तयार करणे (is_published = true)
        const createRes = await DB.savePaper({
            title: newTitle,
            description: 'CSV द्वारे तयार केलेला सराव पेपर.',
            time_minutes: newTime,
            total_marks: newMarks,
            allow_retake: true,
            shuffle_questions: true,
            show_leaderboard: true,
            is_published: true
        });

        if (!createRes.success || !createRes.paper) {
            Swal.fire('त्रुटी', 'नवीन पेपर तयार करता आला नाही: ' + (createRes.message || ''), 'error');
            return;
        }

        targetPaperId = createRes.paper.id;
    } else {
        targetPaperId = document.getElementById('csvTargetPaperSelect')?.value;
        if (!targetPaperId) {
            Swal.fire('पेपर निवडा', 'कृपया प्रश्न जोडण्यासाठी पेपर निवडा.', 'warning');
            return;
        }
    }

    if (parsedCsvQuestions.length === 0) {
        Swal.fire('प्रश्न नाहीत', 'अपलोड करण्यासाठी कोणतेही प्रश्न सापडले नाहीत.', 'warning');
        return;
    }

    const saveBtn = document.getElementById('saveCsvQuestionsBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> डेटाबेसमध्ये सेव्ह व पब्लिश होत आहे...';

    try {
        const res = await DB.importQuestionsBatch(targetPaperId, parsedCsvQuestions);

        if (res.success) {
            Swal.fire({
                icon: 'success',
                title: 'पेपर व प्रश्न यशस्वीरित्या सेव्ह झाले!',
                text: `एकूण ${res.count} प्रश्न जोडले गेले असून हा पेपर विद्यार्थ्यांच्या डॅशबोर्डवर आपोआप पब्लिश झाला आहे!`,
                confirmButtonColor: '#10b981'
            }).then(() => {
                document.getElementById('csvPreviewSection').classList.add('hidden');
                document.getElementById('csvFileInput').value = '';
                const newTitleInput = document.getElementById('csvNewPaperTitle');
                if (newTitleInput) newTitleInput.value = '';
                parsedCsvQuestions = [];
                goToPaperQuestions(targetPaperId);
            });
            await loadAllAdminData();
        } else {
            Swal.fire('त्रुटी', res.message || 'प्रश्न सेव्ह करताना अडचण आली.', 'error');
        }
    } catch (err) {
        console.error(err);
        Swal.fire('त्रुटी', 'प्रश्न सेव्ह करताना अडचण आली: ' + (err.message || ''), 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2"></i> डेटाबेसमध्ये सेव्ह करा व पब्लिश करा';
    }
}

// ====================================================================
// ८. प्रश्न संपादन व ऑटो-कॉम्प्रेस इमेज अपलोड (Question CRUD & WebP)
// ====================================================================

function renderQuestionsList() {
    const container = document.getElementById('questionsContainer');
    if (!container) return;

    const paperId = document.getElementById('filterQuestionPaperSelect')?.value;
    const subject = document.getElementById('filterQuestionSubjectSelect')?.value;

    let questions = allQuestions;
    if (paperId) {
        questions = questions.filter(q => q.paper_id === paperId);
    }
    if (subject && subject !== 'all') {
        questions = questions.filter(q => q.subject === subject);
    }

    if (questions.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <i class="fa-solid fa-clipboard-question text-4xl text-slate-400 mb-3"></i>
                <h3 class="text-sm font-bold text-slate-700">या पेपरमध्ये अजून प्रश्न उपलब्ध नाहीत.</h3>
                <p class="text-xs text-slate-500 mt-1 mb-4">तुम्ही CSV द्वारे किंवा थेट मॅन्युअली प्रश्न जोडू शकता.</p>
                <button onclick="openQuestionModal()" class="px-4 py-2 rounded-lg bg-purple-600 text-white font-bold text-xs">
                    + नवीन प्रश्न जोडा
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = questions.map((q, idx) => `
        <div class="police-card p-5 bg-white border border-slate-200">
            <div class="flex items-start justify-between gap-4">
                <div class="flex-grow">
                    <div class="flex items-center space-x-2 mb-2">
                        <span class="px-2 py-0.5 rounded bg-slate-800 text-white font-mono text-[11px] font-bold">प्र. ${idx + 1}</span>
                        <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[11px]">${escapeHtml(q.subject)}</span>
                        ${q.image_url ? '<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold"><i class="fa-solid fa-image mr-1"></i> इमेज संलग्न</span>' : ''}
                    </div>

                    <h4 class="text-sm font-bold text-slate-900 leading-relaxed">${escapeHtml(q.question_text)}</h4>

                    ${q.image_url ? `
                        <div class="my-3 p-2 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                            <div class="text-[10px] font-bold text-slate-500 uppercase mb-1">संलग्न आकृती / इमेज:</div>
                            <img src="${q.image_url}" alt="Question Image" class="max-h-48 rounded-lg border border-slate-300 shadow-sm object-contain">
                            <button type="button" onclick="removeQuestionImageDirect('${q.id}')" class="mt-1 text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center">
                                <i class="fa-solid fa-trash-can mr-1"></i> इमेज काढून टाका
                            </button>
                        </div>
                    ` : ''}

                    <!-- पर्याय -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                        <div class="p-2 rounded-lg border ${q.correct_option === 'A' ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'}">
                            <span class="font-bold mr-1">A)</span> ${escapeHtml(q.option_a)}
                            ${q.correct_option === 'A' ? ' <i class="fa-solid fa-check text-emerald-600 ml-1"></i>' : ''}
                        </div>
                        <div class="p-2 rounded-lg border ${q.correct_option === 'B' ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'}">
                            <span class="font-bold mr-1">B)</span> ${escapeHtml(q.option_b)}
                            ${q.correct_option === 'B' ? ' <i class="fa-solid fa-check text-emerald-600 ml-1"></i>' : ''}
                        </div>
                        <div class="p-2 rounded-lg border ${q.correct_option === 'C' ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'}">
                            <span class="font-bold mr-1">C)</span> ${escapeHtml(q.option_c)}
                            ${q.correct_option === 'C' ? ' <i class="fa-solid fa-check text-emerald-600 ml-1"></i>' : ''}
                        </div>
                        <div class="p-2 rounded-lg border ${q.correct_option === 'D' ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'}">
                            <span class="font-bold mr-1">D)</span> ${escapeHtml(q.option_d)}
                            ${q.correct_option === 'D' ? ' <i class="fa-solid fa-check text-emerald-600 ml-1"></i>' : ''}
                        </div>
                    </div>

                    ${q.explanation ? `
                        <div class="mt-2.5 p-2 rounded bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-900">
                            <b>स्पष्टीकरण:</b> ${escapeHtml(q.explanation)}
                        </div>
                    ` : ''}
                </div>

                <!-- कृती बटने -->
                <div class="flex flex-col space-y-1.5 shrink-0">
                    <button onclick="editQuestion('${q.id}')" title="प्रश्न संपादन करा" class="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition flex items-center">
                        <i class="fa-solid fa-pen-to-square mr-1"></i> संपादन
                    </button>
                    <label class="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition cursor-pointer flex items-center border border-purple-200">
                        <i class="fa-solid fa-camera mr-1"></i> ${q.image_url ? 'इमेज बदला' : 'इमेज जोडा'}
                        <input type="file" accept="image/*" class="hidden" onchange="handleDirectQuestionImageUpload('${q.id}', this)">
                    </label>
                    <button onclick="deleteQuestion('${q.id}')" title="प्रश्न हटवा" class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition flex items-center">
                        <i class="fa-solid fa-trash-can mr-1"></i> हटवा
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// थेट प्रश्न इमेज काढणे
async function removeQuestionImageDirect(questionId) {
    const q = allQuestions.find(item => item.id === questionId);
    if (!q) return;

    q.image_url = '';
    await DB.saveQuestion(q);
    await loadAllAdminData();
    Swal.fire({ icon: 'success', title: 'इमेज काढली गेली', timer: 1000, showConfirmButton: false });
}

// थेट इमेज अपलोड व WebP ऑटो-कॉम्प्रेस
async function handleDirectQuestionImageUpload(questionId, input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    try {
        Swal.fire({
            title: 'इमेज कॉम्प्रेस होत आहे...',
            text: 'ब्राउझरमध्ये WebP (~40-80 KB) मध्ये ऑप्टिमाइझ करत आहे.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const compressed = await compressImageToDataUrl(file);
        const question = allQuestions.find(q => q.id === questionId);
        if (question) {
            question.image_url = compressed.dataUrl;
            await DB.saveQuestion(question);
            await loadAllAdminData();
            Swal.fire('यशस्वी!', `इमेज जोडली गेली (${compressed.estimatedSizeKb} KB)`, 'success');
        }
    } catch (err) {
        console.error(err);
        Swal.fire('त्रुटी', 'इमेज कॉम्प्रेस करताना अडचण आली.', 'error');
    }
}

// प्रश्न मोडल उघडणे
let currentQuestionImageDataUrl = '';

function openQuestionModal(q = null) {
    const modal = document.getElementById('questionModal');
    const title = document.getElementById('questionModalTitle');
    const form = document.getElementById('questionForm');
    const previewDiv = document.getElementById('qFormImagePreview');
    const clearBtn = document.getElementById('clearImgBtn');

    form.reset();
    currentQuestionImageDataUrl = '';
    previewDiv.classList.add('hidden');
    clearBtn.classList.add('hidden');

    if (q) {
        title.textContent = 'प्रश्न संपादन करा (Edit Question)';
        document.getElementById('qFormId').value = q.id;
        document.getElementById('qFormPaper').value = q.paper_id;
        document.getElementById('qFormSubject').value = q.subject;
        document.getElementById('qFormText').value = q.question_text;
        document.getElementById('qFormOptA').value = q.option_a;
        document.getElementById('qFormOptB').value = q.option_b;
        document.getElementById('qFormOptC').value = q.option_c;
        document.getElementById('qFormOptD').value = q.option_d;
        document.getElementById('qFormCorrect').value = q.correct_option;
        document.getElementById('qFormOrder').value = q.question_order || 1;
        document.getElementById('qFormExplanation').value = q.explanation || '';

        if (q.image_url) {
            currentQuestionImageDataUrl = q.image_url;
            previewDiv.querySelector('img').src = q.image_url;
            previewDiv.classList.remove('hidden');
            clearBtn.classList.remove('hidden');
        }
    } else {
        title.textContent = 'नवीन प्रश्न जोडा (Add Question)';
        document.getElementById('qFormId').value = '';
        const curPaper = document.getElementById('filterQuestionPaperSelect')?.value;
        if (curPaper) document.getElementById('qFormPaper').value = curPaper;
    }

    modal.classList.remove('hidden');
}

function closeQuestionModal() {
    document.getElementById('questionModal').classList.add('hidden');
}

function editQuestion(questionId) {
    const q = allQuestions.find(item => item.id === questionId);
    if (q) openQuestionModal(q);
}

// मोडलमधील इमेज बदलणे
document.getElementById('qFormImageFile')?.addEventListener('change', async function() {
    if (this.files && this.files[0]) {
        try {
            const compressed = await compressImageToDataUrl(this.files[0]);
            currentQuestionImageDataUrl = compressed.dataUrl;

            const previewDiv = document.getElementById('qFormImagePreview');
            previewDiv.querySelector('img').src = currentQuestionImageDataUrl;
            previewDiv.classList.remove('hidden');
            document.getElementById('clearImgBtn').classList.remove('hidden');
        } catch (e) {
            Swal.fire('त्रुटी', 'इमेज वाचण्यात अडचण आली.', 'error');
        }
    }
});

function clearQuestionImage() {
    currentQuestionImageDataUrl = '';
    document.getElementById('qFormImageFile').value = '';
    document.getElementById('qFormImagePreview').classList.add('hidden');
    document.getElementById('clearImgBtn').classList.add('hidden');
}

// प्रश्न सेव्ह करणे
document.getElementById('questionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const qData = {
        id: document.getElementById('qFormId').value || undefined,
        paper_id: document.getElementById('qFormPaper').value,
        subject: document.getElementById('qFormSubject').value,
        question_text: document.getElementById('qFormText').value,
        option_a: document.getElementById('qFormOptA').value,
        option_b: document.getElementById('qFormOptB').value,
        option_c: document.getElementById('qFormOptC').value,
        option_d: document.getElementById('qFormOptD').value,
        correct_option: document.getElementById('qFormCorrect').value,
        question_order: document.getElementById('qFormOrder').value,
        explanation: document.getElementById('qFormExplanation').value,
        image_url: currentQuestionImageDataUrl
    };

    const res = await DB.saveQuestion(qData);
    if (res.success) {
        closeQuestionModal();
        Swal.fire({
            icon: 'success',
            title: 'प्रश्न जतन झाला!',
            timer: 1000,
            showConfirmButton: false
        });
        await loadAllAdminData();
    }
});

// प्रश्न डिलीट करणे
async function deleteQuestion(questionId) {
    Swal.fire({
        title: 'प्रश्न हटवायचा आहे का?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'होय, हटवा',
        cancelButtonText: 'रद्द करा'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await DB.deleteQuestion(questionId);
            await loadAllAdminData();
            Swal.fire('हटवले!', 'प्रश्न काढण्यात आला आहे.', 'success');
        }
    });
}

// ====================================================================
// ९. तक्रारी व शंका निवारण (Flagged Questions)
// ====================================================================

function renderFlagsTable() {
    const tbody = document.getElementById('flagsTableBody');
    if (!tbody) return;

    if (allFlags.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">सध्या कोणतीही प्रलंबित तक्रार किंवा शंका नाही.</td></tr>';
        return;
    }

    tbody.innerHTML = allFlags.map(f => `
        <tr class="hover:bg-slate-50 transition">
            <td class="p-3">
                <div class="font-bold text-slate-900">${escapeHtml(f.student?.full_name || 'परीक्षार्थी')}</div>
                <div class="text-[11px] text-slate-400">${escapeHtml(f.student?.mobile || '-')}</div>
            </td>
            <td class="p-3 font-medium text-slate-700">${escapeHtml(f.paper?.title || 'सराव पेपर')}</td>
            <td class="p-3 max-w-xs truncate" title="${escapeHtml(f.question?.question_text || '')}">
                ${escapeHtml(f.question?.question_text || 'प्रश्न')}
            </td>
            <td class="p-3">
                <span class="font-bold text-rose-700">${escapeHtml(f.reason)}</span>
                ${f.details ? `<p class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(f.details)}</p>` : ''}
            </td>
            <td class="p-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${f.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                    ${f.status === 'resolved' ? 'निवारण झाले' : 'प्रलंबित'}
                </span>
            </td>
            <td class="p-3 text-right">
                ${f.status !== 'resolved' ? `
                    <button onclick="resolveFlag('${f.id}')" class="px-2.5 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition">
                        निवारण झाले
                    </button>
                ` : `
                    <span class="text-xs text-slate-400">सोडवली</span>
                `}
            </td>
        </tr>
    `).join('');
}

async function resolveFlag(flagId) {
    await DB.resolveFlag(flagId);
    await loadAllAdminData();
    Swal.fire('निवारण झाले!', 'तक्रार सोडवली म्हणून चिन्हांकित करण्यात आली.', 'success');
}

// ====================================================================
// १०. Supabase की व URL कॉन्फिग मोडल (Update Keys Modal)
// ====================================================================

function openSupabaseModal() {
    const urlInput = document.getElementById('settingSupabaseUrl');
    const keyInput = document.getElementById('settingSupabaseKey');

    urlInput.value = localStorage.getItem('pyq_supabase_url') || '';
    keyInput.value = localStorage.getItem('pyq_supabase_anon_key') || '';

    document.getElementById('supabaseModal').classList.remove('hidden');
}

function closeSupabaseModal() {
    document.getElementById('supabaseModal').classList.add('hidden');
}

function saveSupabaseSettings() {
    const url = document.getElementById('settingSupabaseUrl').value.trim();
    const key = document.getElementById('settingSupabaseKey').value.trim();

    if (url) localStorage.setItem('pyq_supabase_url', url);
    else localStorage.removeItem('pyq_supabase_url');

    if (key) localStorage.setItem('pyq_supabase_anon_key', key);
    else localStorage.removeItem('pyq_supabase_anon_key');

    closeSupabaseModal();
    Swal.fire({
        icon: 'success',
        title: 'सेटिंग्ज सेव्ह झाल्या!',
        text: 'नवीन Supabase की जोडली आहे. पेज रीलोड होत आहे...',
        timer: 1500,
        showConfirmButton: false
    }).then(() => {
        window.location.reload();
    });
}

// ११. युटिलिटी: HTML एस्केप
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
