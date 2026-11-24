/**
 * ====================================================================
 * महाराष्ट्र पोलीस भरती सराव परीक्षा पोर्टल - निकाल व उत्तरपत्रिका स्क्रिप्ट
 * Report Analytics, Chart.js & Review Engine
 * ====================================================================
 */

const currentUser = Auth.getUser();
if (!currentUser) {
    window.location.href = 'login.html';
}

const urlParams = new URLSearchParams(window.location.search);
const attemptId = urlParams.get('attempt_id');

if (!attemptId) {
    alert("अवैध निकाल आयडी.");
    window.location.href = 'dashboard.html';
}

let attemptData = null;
let reviewFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    await loadReportData();
});

async function loadReportData() {
    try {
        attemptData = await DB.getAttemptById(attemptId);

        if (!attemptData) {
            alert("निकालाची माहिती सापडली नाही.");
            window.location.href = 'dashboard.html';
            return;
        }

        renderScoreBanner();
        renderSubjectAnalysis();
        renderSubjectChart();
        if (attemptData.paper?.show_leaderboard) {
            await loadLeaderboard();
        }
        renderSolutions();

    } catch (err) {
        console.error("निकाल लोड त्रुटी:", err);
    }
}

// १. स्कोअर बॅनर
function renderScoreBanner() {
    const a = attemptData;
    const p = a.paper || { title: 'पोलीस भरती सराव संच' };
    const s = a.student || currentUser;

    document.getElementById('reportPaperTitle').textContent = p.title;
    document.getElementById('reportCandidateInfo').textContent = `परीक्षार्थी: ${s.full_name} (${s.bharti_type || 'पोलीस भरती'}) | दिनांक: ${new Date(a.created_at).toLocaleDateString('mr-IN')}`;

    document.getElementById('reportScore').textContent = `${a.total_score} / ${a.total_questions}`;
    document.getElementById('reportPercentage').textContent = `${a.percentage}% गुण`;

    document.getElementById('reportCorrectCount').textContent = a.correct_count;
    document.getElementById('reportWrongCount').textContent = a.wrong_count;
    document.getElementById('reportUnattemptedCount').textContent = a.unattempted_count;

    // अचूकता = सोडवलेल्यांपैकी किती बरोबर
    const attemptedTotal = a.correct_count + a.wrong_count;
    const accuracy = attemptedTotal > 0 ? Math.round((a.correct_count / attemptedTotal) * 100) : 0;
    document.getElementById('reportAccuracy').textContent = `${accuracy}%`;

    // लागलेला वेळ
    const mins = Math.floor(a.time_taken_seconds / 60);
    const secs = a.time_taken_seconds % 60;
    document.getElementById('reportTimeTaken').textContent = `${mins} मि. ${secs} से.`;
}

// २. विषयनिहाय तक्ता
function renderSubjectAnalysis() {
    const tbody = document.getElementById('subjectAnalysisTableBody');
    if (!tbody) return;

    const analysis = attemptData.subject_analysis_json || {};
    const subjects = Object.keys(analysis);

    if (subjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">माहिती उपलब्ध नाही.</td></tr>';
        return;
    }

    tbody.innerHTML = subjects.map(sub => {
        const item = analysis[sub];
        const subAcc = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;

        return `
            <tr class="hover:bg-slate-50">
                <td class="p-3 font-bold text-slate-800">${escapeHtml(sub)}</td>
                <td class="p-3 text-center font-semibold">${item.total}</td>
                <td class="p-3 text-center font-bold text-emerald-700">${item.correct}</td>
                <td class="p-3 text-center font-bold text-rose-700">${item.wrong}</td>
                <td class="p-3 text-center text-slate-500">${item.unattempted}</td>
                <td class="p-3 text-center font-extrabold text-blue-700">${item.correct} / ${item.total}</td>
                <td class="p-3 text-right">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${subAcc >= 70 ? 'bg-emerald-100 text-emerald-800' : (subAcc >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')}">
                        ${subAcc}%
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// ३. विषयनिहाय Chart.js आलेख
function renderSubjectChart() {
    const canvas = document.getElementById('subjectChart');
    if (!canvas) return;

    const analysis = attemptData.subject_analysis_json || {};
    const labels = Object.keys(analysis);
    const accuracyData = labels.map(sub => {
        const item = analysis[sub];
        return item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
    });

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels.map(l => l.length > 14 ? l.substring(0, 14) + '...' : l),
            datasets: [{
                label: 'अचूकता (%)',
                data: accuracyData,
                backgroundColor: [
                    'rgba(37, 99, 235, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(168, 85, 247, 0.7)',
                    'rgba(245, 158, 11, 0.7)'
                ],
                borderColor: [
                    '#2563eb',
                    '#10b981',
                    '#a855f7',
                    '#f59e0b'
                ],
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: val => val + '%'
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// ४. बॅच लीडरबोर्ड
async function loadLeaderboard() {
    const section = document.getElementById('leaderboardSection');
    const tbody = document.getElementById('leaderboardTableBody');
    const myRankBadge = document.getElementById('myRankBadge');

    try {
        const leaderboard = await DB.getPaperLeaderboard(attemptData.paper_id);
        if (!leaderboard || leaderboard.length === 0) return;

        section.classList.remove('hidden');

        // उमेदवाराचा रँक शोधणे
        const myRankItem = leaderboard.find(l => l.student_name === currentUser.full_name);
        if (myRankItem) {
            myRankBadge.textContent = `तुमचा रँक: ${myRankItem.rank} वा (एकूण ${leaderboard.length} पैकी)`;
        } else {
            myRankBadge.textContent = `एकूण परीक्षार्थी: ${leaderboard.length}`;
        }

        // टॉप १०
        const top10 = leaderboard.slice(0, 10);
        tbody.innerHTML = top10.map(l => {
            const isMe = (l.student_name === currentUser.full_name);
            const mins = Math.floor(l.time_taken / 60);
            const secs = l.time_taken % 60;

            return `
                <tr class="${isMe ? 'bg-amber-50 font-bold border-l-4 border-amber-500' : 'hover:bg-slate-50'}">
                    <td class="p-2.5 text-center">
                        ${l.rank === 1 ? '<i class="fa-solid fa-crown text-amber-500"></i>' : l.rank}
                    </td>
                    <td class="p-2.5">
                        <span class="${isMe ? 'text-amber-900 font-extrabold' : 'text-slate-900'}">${escapeHtml(l.student_name)}</span>
                        ${isMe ? ' <span class="text-[10px] text-amber-600 font-bold">(तुम्ही)</span>' : ''}
                    </td>
                    <td class="p-2.5 text-slate-500">${escapeHtml(l.bharti_type || '-')}</td>
                    <td class="p-2.5 text-center font-extrabold text-blue-700">${l.total_score}</td>
                    <td class="p-2.5 text-center font-bold text-emerald-700">${l.percentage}%</td>
                    <td class="p-2.5 text-right font-mono text-slate-500">${mins}m ${secs}s</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("लीडरबोर्ड त्रुटी:", e);
    }
}

// ५. उत्तरपत्रिका तपासणी (Review Filters & Solutions)
function setReviewFilter(filter) {
    reviewFilter = filter;
    const buttons = ['all', 'wrong', 'correct', 'unattempted'];
    buttons.forEach(b => {
        const btn = document.getElementById(`rfBtn-${b}`);
        if (btn) {
            if (b === filter) {
                btn.className = "px-3 py-1.5 rounded-lg bg-slate-900 text-white";
            } else {
                btn.className = "px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200";
            }
        }
    });

    renderSolutions();
}

function renderSolutions() {
    const container = document.getElementById('solutionsContainer');
    if (!container) return;

    const questions = attemptData.questions || [];
    const answers = attemptData.answers_json || {};

    let filtered = questions;
    if (reviewFilter === 'wrong') {
        filtered = questions.filter(q => answers[q.id] && answers[q.id].toUpperCase() !== q.correct_option.toUpperCase());
    } else if (reviewFilter === 'correct') {
        filtered = questions.filter(q => answers[q.id] && answers[q.id].toUpperCase() === q.correct_option.toUpperCase());
    } else if (reviewFilter === 'unattempted') {
        filtered = questions.filter(q => !answers[q.id]);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <i class="fa-solid fa-circle-check text-3xl text-emerald-500 mb-2"></i>
                <p class="text-xs font-bold text-slate-700">या फिल्टरनुसार कोणतेही प्रश्न सापडले नाहीत.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map((q, idx) => {
        const studentChoice = answers[q.id] || null;
        const isCorrect = studentChoice && (studentChoice.toUpperCase() === q.correct_option.toUpperCase());
        const isUnattempted = !studentChoice;

        let statusBadge = '';
        if (isUnattempted) {
            statusBadge = '<span class="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">न सोडवलेला प्रश्न</span>';
        } else if (isCorrect) {
            statusBadge = '<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold"><i class="fa-solid fa-check mr-1"></i> बरोबर (+१ गुण)</span>';
        } else {
            statusBadge = '<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold"><i class="fa-solid fa-xmark mr-1"></i> चुकीचे उत्तर (० गुण)</span>';
        }

        const opts = [
            { key: 'A', text: q.option_a, label: 'अ' },
            { key: 'B', text: q.option_b, label: 'ब' },
            { key: 'C', text: q.option_c, label: 'क' },
            { key: 'D', text: q.option_d, label: 'ड' }
        ];

        return `
            <div class="police-card p-5 bg-white border ${isCorrect ? 'border-emerald-200' : (isUnattempted ? 'border-slate-200' : 'border-rose-200')}">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex items-center space-x-2">
                        <span class="px-2 py-0.5 rounded bg-slate-800 text-white font-mono text-[11px] font-bold">प्र. ${q.question_order || (idx + 1)}</span>
                        <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px] font-semibold">${escapeHtml(q.subject)}</span>
                        ${statusBadge}
                    </div>

                    <button onclick="openFlagModal('${q.id}')" title="प्रश्नात चूक कळवा" class="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center transition no-print">
                        <i class="fa-solid fa-flag mr-1"></i> चूक कळवा
                    </button>
                </div>

                <div class="text-sm font-bold text-slate-900 leading-relaxed mb-3">
                    ${escapeHtml(q.question_text)}
                </div>

                ${q.image_url ? `
                    <div class="mb-3">
                        <img src="${q.image_url}" alt="Question Image" class="max-h-48 rounded border border-slate-200 object-contain">
                    </div>
                ` : ''}

                <!-- पर्यायांचे रंगीत विश्लेषण -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mt-3">
                    ${opts.map(opt => {
                        const isStudentPick = (studentChoice === opt.key);
                        const isRightAnswer = (q.correct_option === opt.key);

                        let optClass = 'bg-slate-50 border-slate-200 text-slate-700';
                        let badgeIcon = '';

                        if (isRightAnswer) {
                            optClass = 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900';
                            badgeIcon = '<span class="ml-auto px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">बरोबर उत्तर ✓</span>';
                        } else if (isStudentPick && !isRightAnswer) {
                            optClass = 'bg-rose-50 border-rose-500 font-bold text-rose-900';
                            badgeIcon = '<span class="ml-auto px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">तुमची निवड ✕</span>';
                        }

                        if (isStudentPick && isRightAnswer) {
                            badgeIcon = '<span class="ml-auto px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-bold">तुमची निवड व बरोबर उत्तर ✓</span>';
                        }

                        return `
                            <div class="p-2.5 rounded-xl border flex items-center ${optClass}">
                                <span class="font-bold mr-1.5">${opt.label})</span>
                                <span class="truncate">${escapeHtml(opt.text)}</span>
                                ${badgeIcon}
                            </div>
                        `;
                    }).join('')}
                </div>

                ${q.explanation ? `
                    <div class="mt-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                        <div class="font-bold text-amber-800 mb-0.5 flex items-center">
                            <i class="fa-solid fa-lightbulb mr-1.5 text-amber-600"></i> स्पष्टीकरण (Explanation):
                        </div>
                        ${escapeHtml(q.explanation)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ६. प्रश्नात चूक कळवणे मोडल (Flag Modal)
function openFlagModal(questionId) {
    document.getElementById('flagQuestionId').value = questionId;
    document.getElementById('flagModal').classList.remove('hidden');
}

function closeFlagModal() {
    document.getElementById('flagModal').classList.add('hidden');
}

document.getElementById('flagForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const questionId = document.getElementById('flagQuestionId').value;
    const reason = document.getElementById('flagReason').value;
    const details = document.getElementById('flagDetails').value;

    const res = await DB.flagQuestion({
        questionId: questionId,
        studentId: currentUser.id,
        paperId: attemptData.paper_id,
        reason: reason,
        details: details
    });

    if (res.success) {
        closeFlagModal();
        Swal.fire({
            icon: 'success',
            title: 'शंका नोंदवली गेली!',
            text: 'तुमची तक्रार ॲडमिनकडे पाठवली आहे. लवकरच तपासणी केली जाईल.',
            confirmButtonColor: '#10b981'
        });
    }
});

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
