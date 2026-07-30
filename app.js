// DOM Elements
const sidebarNav = document.querySelectorAll('.nav-item');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const themeToggleBtn = document.getElementById('theme-toggle');
const pageTitle = document.getElementById('page-title');
const levelBadge = document.getElementById('level-badge');
const xpBarFill = document.getElementById('xp-bar-fill');
const currentXpEl = document.getElementById('current-xp');
const nextLevelXpEl = document.getElementById('next-level-xp');

// Views
const welcomeView = document.getElementById('welcome-view');
const theoryView = document.getElementById('theory-view');
const quizView = document.getElementById('quiz-view');
const resultView = document.getElementById('result-view');
const profileView = document.getElementById('profile-view');
const statsView = document.getElementById('stats-view');

// Quiz DOM
const qTitle = document.getElementById('q-title');
const qText = document.getElementById('q-text');
const qOptions = document.getElementById('q-options');
const qFeedback = document.getElementById('q-feedback');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackNote = document.getElementById('feedback-note');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnSubmitExam = document.getElementById('btn-submit-exam');
const progressBar = document.getElementById('quiz-progress-bar');
const currentQIdx = document.getElementById('current-q-idx');
const totalQCount = document.getElementById('total-q-count');

// Exam DOM
const examTimerContainer = document.getElementById('exam-timer-container');
const examTimerEl = document.getElementById('exam-timer');
const resultScore = document.getElementById('result-score');
const resultCorrect = document.getElementById('result-correct');
const resultWrong = document.getElementById('result-wrong');
const examReviewContainer = document.getElementById('exam-review-container');
const examReviewList = document.getElementById('exam-review-list');
const btnReviewExam = document.getElementById('btn-review-exam');
const btnRetryExam = document.getElementById('btn-retry-exam');

// State
let currentMode = null; // 'theory', 'practice', 'exam', 'profile'
let currentQuestions = [];
let currentQuestionIndex = 0;
let activeQuestion = null;
let userAnswers = new Map(); // store answers: Map(question_obj -> { selected: 'A', correct: true/false, tries: 1 })
let score = 0; // Temp score in practice
let reviewQueue = []; // Questions to review if failed in practice mode
let isExamSubmitted = false;
let examTimer = null;
let examSeconds = 0;

// Gamification State
let totalXP = parseInt(localStorage.getItem('jpd_xp') || '0');
let achievements = JSON.parse(localStorage.getItem('jpd_achievements') || '[]');
let questionStats = JSON.parse(localStorage.getItem('jpd_question_stats') || '{}');

function saveQuestionStats() {
    localStorage.setItem('jpd_question_stats', JSON.stringify(questionStats));
}

const ALL_ACHIEVEMENTS = [
    { id: 'night_owl', icon: '🦉', title: 'Cú Đêm', desc: 'Học bài trong khoảng từ 00:00 đến 04:00 sáng.' },
    { id: 'immortal', icon: '🛡️', title: 'Bất Tử', desc: 'Đạt 10/10 điểm trong bài thi thử FE.' },
    { id: 'stubborn', icon: '🥊', title: 'Lì Đòn', desc: 'Trả lời đúng một câu hỏi sau khi bị sai và phải ôn lại.' },
    { id: 'hardworker', icon: '🎓', title: 'Chăm Chỉ', desc: 'Tích lũy được 1,000 XP đầu tiên.' }
];

// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Init
function init() {
    // Set theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
    
    updateHeaderStats();
    
    // Event listeners
    themeToggleBtn.addEventListener('click', toggleTheme);
    mobileMenuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    
    sidebarNav.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            sidebarNav.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            if(window.innerWidth <= 768) sidebar.classList.remove('open');
            
            const view = item.getAttribute('data-view');
            const target = item.getAttribute('data-target');
            
            handleNavigation(view, target, item.innerText);
        });
    });

    btnNext.addEventListener('click', handleNextAction);
    btnPrev.addEventListener('click', handlePrevAction);
    btnSubmitExam.addEventListener('click', submitExam);
    btnReviewExam.addEventListener('click', () => {
        examReviewContainer.classList.toggle('hidden');
    });
    btnRetryExam.addEventListener('click', () => {
        // Find the active nav item and click it again to restart
        document.querySelector('.nav-item.active').click();
    });
}

function toggleTheme() {
    if (document.body.getAttribute('data-theme') === 'dark') {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

function hideAllViews() {
    welcomeView.classList.add('hidden');
    theoryView.classList.add('hidden');
    quizView.classList.add('hidden');
    resultView.classList.add('hidden');
    profileView.classList.add('hidden');
    statsView.classList.add('hidden');
    examTimerContainer.classList.add('hidden');
    stopTimer();
}

function handleNavigation(view, target, titleText) {
    hideAllViews();
    pageTitle.innerText = titleText;
    
    if (view === 'theory') {
        currentMode = 'theory';
        theoryView.classList.remove('hidden');
        renderTheory(target);
    } else if (view === 'practice') {
        currentMode = 'practice';
        quizView.classList.remove('hidden');
        startPractice(target);
    } else if (view === 'exam') {
        currentMode = 'exam';
        quizView.classList.remove('hidden');
        startExam(target);
    } else if (view === 'profile') {
        currentMode = 'profile';
        hideAllViews();
        profileView.classList.remove('hidden');
        renderProfile();
    } else if (view === 'stats') {
        currentMode = 'stats';
        hideAllViews();
        statsView.classList.remove('hidden');
        renderStats();
    }
}

// --- Theory Mode ---
function renderTheory(target) {
    const theoryContent = document.getElementById('theory-content');
    const content = db.theory[target];
    if (content) {
        theoryContent.innerHTML = marked.parse(content);
    } else {
        theoryContent.innerHTML = "<p>Nội dung đang được cập nhật...</p>";
    }
}

// --- Practice Mode ---
function startPractice(target) {
    if (target === 'all') {
        currentQuestions = [];
        for (let key in db.questions) {
            currentQuestions = currentQuestions.concat(db.questions[key]);
        }
    } else {
        // Clone the questions to avoid mutating original db
        currentQuestions = [...db.questions[target]];
    }
    
    // Adaptive Learning Sort (Spaced Repetition)
    currentQuestions.sort((a, b) => {
        const statA = questionStats[a.id] || { attempts: 0, correct: 0, lastSeen: 0 };
        const statB = questionStats[b.id] || { attempts: 0, correct: 0, lastSeen: 0 };
        
        const getWeight = (stat) => {
            if (stat.attempts === 0) return 100; // Unseen gets highest priority
            const accuracy = stat.correct / stat.attempts;
            let weight = (1 - accuracy) * 80;
            
            const daysSinceSeen = (Date.now() - stat.lastSeen) / (1000 * 60 * 60 * 24);
            weight += Math.min(daysSinceSeen * 2, 20); // Max +20 weight for old questions
            
            return weight;
        };
        
        const weightA = getWeight(statA) + (Math.random() * 20); // Add jitter for randomness
        const weightB = getWeight(statB) + (Math.random() * 20);
        
        return weightB - weightA; // Sort descending (highest weight first)
    });
    
    currentQuestionIndex = 0;
    userAnswers = new Map();
    score = 0;
    reviewQueue = [];
    
    btnPrev.classList.add('hidden'); // No going back in practice mode
    btnSubmitExam.classList.add('hidden');
    btnNext.classList.remove('hidden');
    
    renderQuestion();
}

// --- Exam Mode ---
function startExam(target) {
    currentQuestions = [...db.fe[target]];
    currentQuestionIndex = 0;
    userAnswers = new Map();
    isExamSubmitted = false;
    
    btnPrev.classList.remove('hidden');
    
    // Exam setup
    examTimerContainer.classList.remove('hidden');
    startTimer();
    
    renderQuestion();
}

// --- Quiz Logic ---
function renderQuestion() {
    const isPractice = (currentMode === 'practice');
    let q;
    
    if (isPractice) {
        // If we finished normal questions, pull from review queue
        if (currentQuestionIndex >= currentQuestions.length) {
            if (reviewQueue.length > 0) {
                q = reviewQueue.shift(); // take the first item to review
                userAnswers.delete(q); // Clear previous attempt so user can answer again
                // Shuffle its options keys A B C D just for display (Optional advanced feature, let's keep it simple for now)
            } else {
                // Done!
                finishPractice();
                return;
            }
        } else {
            q = currentQuestions[currentQuestionIndex];
        }
    } else {
        // Exam mode
        q = currentQuestions[currentQuestionIndex];
    }
    
    // Update progress
    const total = isPractice ? currentQuestions.length + reviewQueue.length + (currentQuestionIndex >= currentQuestions.length ? 1 : 0) : currentQuestions.length;
    const current = isPractice && currentQuestionIndex >= currentQuestions.length ? currentQuestions.length : currentQuestionIndex + 1;
    
    currentQIdx.innerText = isPractice ? "..." : (currentQuestionIndex + 1);
    totalQCount.innerText = isPractice ? "..." : total;
    progressBar.style.width = isPractice ? "100%" : `${((currentQuestionIndex + 1) / total) * 100}%`;
    
    qTitle.innerText = `Câu ${q.id.replace('## Câu ', '')}`;
    
    // Highlight bracket text if any using regex: [text] or 【text】
    let formattedText = q.text.replace(/\[(.*?)\]/g, '<span style="color:var(--primary); font-weight:bold">[$1]</span>');
    formattedText = formattedText.replace(/【(.*?)】/g, '<span style="color:var(--primary); font-weight:bold">【$1】</span>');
    qText.innerHTML = formattedText.replace(/\n/g, '<br>');
    
    qOptions.innerHTML = '';
    qFeedback.classList.add('hidden');
    
    // Render options
    // If practice mode and returning to a question we failed, shuffle the keys A, B, C, D
    let keys = Object.keys(q.options);
    if (isPractice && currentQuestionIndex >= currentQuestions.length) {
        keys.sort(() => Math.random() - 0.5); // Shuffle A B C D
    }
    
    keys.forEach(key => {
        const div = document.createElement('div');
        div.className = 'option-card';
        div.setAttribute('data-key', key);
        div.innerHTML = `
            <div class="option-letter">${key}</div>
            <div class="option-text">${q.options[key]}</div>
        `;
        
        div.addEventListener('click', () => selectOption(div, key, q));
        qOptions.appendChild(div);
    });
    
    // State restoration (if user already answered)
    const savedAnswer = userAnswers.get(q);
    
    if (isPractice) {
        btnNext.innerText = 'Kiểm tra';
        btnNext.disabled = true;
    } else {
        // Exam mode
        if (savedAnswer) {
            const selectedDiv = qOptions.querySelector(`[data-key="${savedAnswer.selected}"]`);
            if (selectedDiv) selectedDiv.classList.add('selected');
        }
        updateExamButtons();
    }
    
    activeQuestion = q;
}

function selectOption(element, key, question) {
    if (currentMode === 'practice') {
        // In practice, if already answered, don't allow change
        const ans = userAnswers.get(question);
        if (ans && ans.checked) return;
        
        // Deselect others
        document.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        
        // Save temporary selection
        userAnswers.set(question, { selected: key });
        btnNext.disabled = false;
        
    } else if (currentMode === 'exam') {
        if (isExamSubmitted) return;
        
        document.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        userAnswers.set(question, { selected: key });
        updateExamButtons();
    }
}

function handleNextAction() {
    if (currentMode === 'practice') {
        const currentQ = activeQuestion;
        if (!currentQ) return;
        
        // Ensure userAnswers object exists for this question (created in selectOption)
        let ans = userAnswers.get(currentQ);
        if (!ans) {
            ans = {};
            userAnswers.set(currentQ, ans);
        }
        
        if (!ans.checked) {
            // Check answer
            ans.checked = true;
            const isCorrect = (ans.selected === currentQ.answer);
            ans.correct = isCorrect;
            
            // Update stats
            if (!questionStats[currentQ.id]) {
                questionStats[currentQ.id] = { attempts: 0, correct: 0, lastSeen: 0 };
            }
            questionStats[currentQ.id].attempts += 1;
            if (isCorrect) {
                questionStats[currentQ.id].correct += 1;
            }
            questionStats[currentQ.id].lastSeen = Date.now();
            saveQuestionStats();
            
            const selectedEl = document.querySelector('.option-card.selected');
            const correctEl = document.querySelector(`.option-card[data-key="${currentQ.answer}"]`);
            
            document.querySelectorAll('.option-card').forEach(el => el.classList.add('disabled'));
            
            if (isCorrect) {
                playSound('correct');
                selectedEl.classList.add('correct');
                showFeedback(true, currentQ.note);
                if (currentQuestionIndex < currentQuestions.length) {
                    addXP(10);
                } else {
                    // Corrected in review mode
                    unlockAchievement('stubborn');
                }
            } else {
                playSound('wrong');
                selectedEl.classList.add('wrong');
                if(correctEl) correctEl.classList.add('correct');
                
                // Shake animation
                const container = document.getElementById('question-container');
                container.classList.remove('shake');
                void container.offsetWidth; // trigger reflow
                container.classList.add('shake');
                
                showFeedback(false, currentQ.note || `Đáp án đúng là ${currentQ.answer}.`);
                
                // Add to review queue if in practice mode (keep practicing until correct)
                reviewQueue.push(currentQ);
            }
            
            btnNext.innerText = 'Tiếp tục';
        } else {
            // Move to next
            if (currentQuestionIndex < currentQuestions.length) {
                currentQuestionIndex++;
            }
            renderQuestion();
        }
    } else if (currentMode === 'exam') {
        if (currentQuestionIndex < currentQuestions.length - 1) {
            currentQuestionIndex++;
            renderQuestion();
        }
    }
}

function handlePrevAction() {
    if (currentMode === 'exam') {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderQuestion();
        }
    }
}

function updateExamButtons() {
    btnPrev.disabled = (currentQuestionIndex === 0);
    
    if (currentQuestionIndex === currentQuestions.length - 1) {
        btnNext.classList.add('hidden');
        btnSubmitExam.classList.remove('hidden');
        // Enable submit if all answered? No, allow submit anytime.
    } else {
        btnNext.classList.remove('hidden');
        btnSubmitExam.classList.add('hidden');
        btnNext.disabled = false;
    }
}

function showFeedback(isCorrect, note) {
    qFeedback.classList.remove('hidden', 'success', 'error');
    qFeedback.classList.add(isCorrect ? 'success' : 'error');
    
    feedbackIcon.innerHTML = isCorrect ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>';
    feedbackTitle.innerText = isCorrect ? 'Chính xác!' : 'Chưa chính xác!';
    
    let noteHtml = note ? marked.parse(note) : '';
    
    // Add Gemini Notebook Button
    if (activeQuestion) {
        const promptText = `Tôi là người mất gốc. Hãy giải thích chi tiết câu hỏi này: "${activeQuestion.text}". Đáp án đúng là: ${activeQuestion.answer} - ${activeQuestion.options[activeQuestion.answer]}. Dịch nghĩa từng chữ, chỉ ra ngữ pháp và tại sao các đáp án kia sai.`;
        const encodedPrompt = promptText.replace(/"/g, '&quot;').replace(/\n/g, ' ');
        noteHtml += `
            <div style="margin-top: 15px;">
                <button class="btn btn-primary" style="background-color: #8e44ad; border-color: #8e44ad; padding: 6px 12px; font-size: 0.9rem;" onclick="askGeminiNotebook('${activeQuestion.id}', '${encodedPrompt}')">
                    <i class="fa-solid fa-sparkles"></i> ✨ Hỏi Gemini Notebook
                </button>
            </div>
        `;
    }
    
    feedbackNote.innerHTML = noteHtml;
}

function finishPractice() {
    qTitle.innerText = "Hoàn thành!";
    qText.innerHTML = `Tuyệt vời, bạn đã ôn tập xong bộ câu hỏi này.`;
    qOptions.innerHTML = '';
    qFeedback.classList.add('hidden');
    btnNext.classList.add('hidden');
    playSound('victory');
    checkNightOwl();
}

// --- Exam Timer & Submit ---
function startTimer() {
    examSeconds = 0;
    clearInterval(examTimer);
    examTimerEl.innerText = "00:00";
    examTimer = setInterval(() => {
        examSeconds++;
        const m = String(Math.floor(examSeconds / 60)).padStart(2, '0');
        const s = String(examSeconds % 60).padStart(2, '0');
        examTimerEl.innerText = `${m}:${s}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(examTimer);
}

function submitExam() {
    if(!confirm("Bạn có chắc chắn muốn nộp bài?")) return;
    
    isExamSubmitted = true;
    stopTimer();
    
    // Calculate Score
    let correctCount = 0;
    let wrongCount = 0;
    let reviewHTML = '';
    
    currentQuestions.forEach((q, idx) => {
        const ans = userAnswers.get(q);
        if (ans && ans.selected === q.answer) {
            correctCount++;
        } else {
            wrongCount++;
            // Generate review snippet
            const userChoice = ans ? ans.selected : 'Chưa chọn';
            const promptText = `Tôi là người mất gốc. Hãy giải thích chi tiết câu hỏi này: "${q.text}". Đáp án đúng là: ${q.answer} - ${q.options[q.answer]}. Dịch nghĩa từng chữ, chỉ ra ngữ pháp và tại sao các đáp án kia sai.`;
            const encodedPrompt = promptText.replace(/"/g, '&quot;').replace(/\n/g, ' ');
            
            reviewHTML += `
                <div class="review-item">
                    <h4>Câu ${idx + 1}: <br><br> ${q.text.replace(/\n/g, '<br>')}</h4>
                    <p><strong>Bạn chọn:</strong> ${userChoice} ${ans && q.options[userChoice] ? ' - ' + q.options[userChoice] : ''}</p>
                    <p style="color:var(--success)"><strong>Đáp án đúng:</strong> ${q.answer} - ${q.options[q.answer]}</p>
                    ${q.note ? `<div style="margin-top:10px; font-size:0.9em; color:var(--text-muted)">Ghi chú: ${marked.parse(q.note)}</div>` : ''}
                    <div style="margin-top: 10px;">
                        <button class="btn btn-primary" style="background-color: #8e44ad; border-color: #8e44ad; padding: 4px 10px; font-size: 0.85rem;" onclick="askGeminiNotebook('${q.id}', '${encodedPrompt}')">
                            ✨ Hỏi Gemini
                        </button>
                    </div>
                </div>
            `;
        }
    });
    
    const finalScore = ((correctCount / currentQuestions.length) * 10).toFixed(1);
    
    quizView.classList.add('hidden');
    resultView.classList.remove('hidden');
    
    resultScore.innerText = finalScore;
    resultCorrect.innerText = correctCount;
    resultWrong.innerText = wrongCount;
    
    examReviewList.innerHTML = reviewHTML || '<p>Tuyệt vời, bạn không làm sai câu nào!</p>';
    examReviewContainer.classList.add('hidden');
    
    // Gamification
    addXP(Math.round(parseFloat(finalScore) * 10));
    if (parseFloat(finalScore) === 10) {
        unlockAchievement('immortal');
        triggerConfetti();
        playSound('victory');
    }
    checkNightOwl();
}

// --- Gamification Logic ---
function getLevel(xp) {
    // 0=1, 100=2, 300=3, 600=4, 1000=5...
    let level = 1;
    let required = 100;
    let step = 200;
    while (xp >= required) {
        level++;
        xp -= required;
        required += step;
    }
    return { level, current: xp, next: required, total: totalXP };
}

function getLevelTitle(level) {
    if (level < 3) return "Tân Binh Hiragana";
    if (level < 6) return "Thợ Săn Kanji";
    if (level < 9) return "Bậc Thầy Ngữ Pháp";
    return "Chiến Thần JPD123";
}

function updateHeaderStats() {
    const stats = getLevel(totalXP);
    levelBadge.innerText = `Lv.${stats.level}`;
    currentXpEl.innerText = stats.current;
    nextLevelXpEl.innerText = stats.next;
    xpBarFill.style.width = `${(stats.current / stats.next) * 100}%`;
}

function addXP(amount) {
    const oldLevel = getLevel(totalXP).level;
    totalXP += amount;
    localStorage.setItem('jpd_xp', totalXP);
    
    const newLevel = getLevel(totalXP).level;
    updateHeaderStats();
    
    if (totalXP >= 1000) unlockAchievement('hardworker');
    
    if (newLevel > oldLevel) {
        playSound('victory');
        triggerConfetti();
        alert(`Chúc mừng! Bạn đã đạt Cấp ${newLevel} - ${getLevelTitle(newLevel)}!`);
    }
}

function unlockAchievement(id) {
    if (!achievements.includes(id)) {
        achievements.push(id);
        localStorage.setItem('jpd_achievements', JSON.stringify(achievements));
        
        // Notify
        const item = ALL_ACHIEVEMENTS.find(x => x.id === id);
        if (item) {
            playSound('correct');
            alert(`🏆 Mở khóa thành tựu mới: ${item.title}\n${item.desc}`);
        }
    }
}

function checkNightOwl() {
    const hour = new Date().getHours();
    if (hour >= 0 && hour <= 4) {
        unlockAchievement('night_owl');
    }
}

function renderProfile() {
    const stats = getLevel(totalXP);
    document.getElementById('profile-title').innerText = getLevelTitle(stats.level);
    document.getElementById('profile-level').innerText = stats.level;
    document.getElementById('profile-total-xp').innerText = totalXP;
    
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '';
    
    ALL_ACHIEVEMENTS.forEach(a => {
        const unlocked = achievements.includes(a.id);
        grid.innerHTML += `
            <div class="achievement-card ${unlocked ? 'unlocked' : ''}">
                <div class="achievement-icon">${a.icon}</div>
                <h4>${a.title}</h4>
                <p>${a.desc}</p>
            </div>
        `;
    });
    
    // Load Notebook URL
    const urlInput = document.getElementById('notebook-url');
    if (urlInput) {
        urlInput.value = localStorage.getItem('gemini_notebook_url') || '';
    }
}

function saveNotebookUrl() {
    const urlInput = document.getElementById('notebook-url');
    if (urlInput && urlInput.value) {
        localStorage.setItem('gemini_notebook_url', urlInput.value.trim());
        const msg = document.getElementById('notebook-url-msg');
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 3000);
    }
}

function renderStats() {
    const allQuestions = [];
    for (const key in db.questions) {
        allQuestions.push(...db.questions[key]);
    }
    const totalQ = allQuestions.length;
    
    let totalAttempts = 0;
    let totalCorrect = 0;
    let seenCount = 0;
    let masteredCount = 0;
    let weakList = [];
    
    for (const [qId, stat] of Object.entries(questionStats)) {
        if (stat.attempts > 0) {
            seenCount++;
            totalAttempts += stat.attempts;
            totalCorrect += stat.correct;
            
            const acc = stat.correct / stat.attempts;
            const qObj = allQuestions.find(q => q.id === qId);
            
            if (qObj) {
                if (acc >= 0.8 && stat.attempts >= 3) {
                    masteredCount++;
                } else if (acc <= 0.5 && stat.attempts >= 1) {
                    weakList.push({ q: qObj, stat, acc });
                }
            }
        }
    }
    
    const overallAcc = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    const coverage = Math.round((seenCount / totalQ) * 100);
    
    document.getElementById('stat-total-seen').innerText = `${seenCount} / ${totalQ}`;
    document.getElementById('stat-accuracy').innerText = `${overallAcc}%`;
    document.getElementById('stat-mastered').innerText = masteredCount;
    document.getElementById('stat-weak').innerText = weakList.length;
    
    document.getElementById('coverage-bar').style.width = `${coverage}%`;
    document.getElementById('coverage-text').innerText = `${coverage}% hoàn thành`;
    
    const weakListEl = document.getElementById('weak-questions-list');
    weakListEl.innerHTML = '';
    
    if (weakList.length === 0) {
        weakListEl.innerHTML = '<p style="color:var(--text-muted); font-style:italic">Tuyệt vời! Hiện tại bạn không có câu nào bị đánh giá là yếu kém.</p>';
    } else {
        weakList.sort((a,b) => a.acc - b.acc).slice(0, 10).forEach((item, index) => {
            const accPercent = Math.round(item.acc * 100);
            weakListEl.innerHTML += `
                <div class="weak-item">
                    <h4>Top ${index + 1}: ${item.q.id}</h4>
                    <p style="margin-bottom:10px">${item.q.text.replace(/\n/g, '<br>')}</p>
                    <div class="weak-stats">
                        <span>Số lần chọn: ${item.stat.attempts}</span>
                        <span class="weak-accuracy">Tỉ lệ đúng: ${accPercent}%</span>
                    </div>
                </div>
            `;
        });
    }
}

function askGeminiNotebook(qId, prompt) {
    // Copy to clipboard
    navigator.clipboard.writeText(prompt).then(() => {
        let url = localStorage.getItem('gemini_notebook_url');
        if (!url) {
            // Default URL if user hasn't set one yet
            url = 'https://gemini.google.com/notebook/acac02d3-266d-4e1d-b554-72970c3b1bd6';
        }
        alert('Đã copy câu hỏi vào Khay nhớ tạm (Clipboard)!\nTrình duyệt sẽ mở tab Gemini Notebook ngay bây giờ. Hãy nhấn Ctrl+V ở ô Hỏi Gemini nhé.');
        window.open(url, '_blank');
    }).catch(err => {
        alert('Không thể copy vào clipboard. Lỗi trình duyệt: ' + err);
    });
}

function exportMetadata() {
    let md = `# Thống kê Học tập JPD123\nNgày xuất báo cáo: ${new Date().toLocaleString()}\n\n`;
    
    md += `## 1. Tổng quan\n`;
    md += `- Cấp độ hiện tại: ${getLevel(totalXP).level} (${getLevelTitle(getLevel(totalXP).level)})\n`;
    md += `- Tổng XP: ${totalXP}\n`;
    md += `- Tổng số câu đã tương tác: ${Object.keys(questionStats).length}\n\n`;
    
    let weakQuestions = [];
    let masteredQuestions = [];
    
    // Create a lookup for all questions across all targets
    const allQuestions = [];
    for (const key in db.questions) {
        allQuestions.push(...db.questions[key]);
    }
    
    for (const [qId, stat] of Object.entries(questionStats)) {
        if (stat.attempts > 0) {
            const acc = stat.correct / stat.attempts;
            const qObj = allQuestions.find(q => q.id === qId);
            if (qObj) {
                if (acc <= 0.5 && stat.attempts >= 2) {
                    weakQuestions.push({ q: qObj, stat });
                } else if (acc >= 0.8 && stat.attempts >= 3) {
                    masteredQuestions.push({ q: qObj, stat });
                }
            }
        }
    }
    
    md += `## 2. Điểm yếu cần khắc phục (Sai nhiều lần)\n`;
    md += `*Gửi AI: Hãy phân tích các câu dưới đây, tìm ra điểm yếu ngữ pháp/từ vựng chung của tôi và tạo thêm bài giảng để tôi ôn tập.*\n\n`;
    if (weakQuestions.length === 0) md += `- Trống (Chưa có dữ liệu hoặc bạn làm rất tốt!)\n`;
    
    weakQuestions.sort((a,b) => (a.stat.correct/a.stat.attempts) - (b.stat.correct/b.stat.attempts)).slice(0, 20).forEach(item => {
        md += `### ${item.q.id}\n`;
        md += `- Câu hỏi: ${item.q.text.replace(/\n/g, ' ')}\n`;
        md += `- Tỉ lệ đúng: ${item.stat.correct}/${item.stat.attempts} (${Math.round((item.stat.correct/item.stat.attempts)*100)}%)\n\n`;
    });
    
    md += `\n## 3. Câu hỏi đã thành thạo\n`;
    md += `*Gửi AI: Có thể bỏ qua giải thích cho các câu này vì tôi đã nắm vững.*\n\n`;
    if (masteredQuestions.length === 0) md += `- Trống\n`;
    masteredQuestions.forEach(item => {
        md += `- ${item.q.id} (Tỉ lệ: ${Math.round((item.stat.correct/item.stat.attempts)*100)}%)\n`;
    });
    
    // Trigger download
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JPD123_Learning_Profile_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Audio & Effects ---
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.setValueAtTime(120, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'victory') {
        osc.type = 'square';
        const now = audioCtx.currentTime;
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start();
        osc.stop(now + 0.6);
    }
}

function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

// Run init
init();
