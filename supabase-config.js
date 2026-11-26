/**
 * ====================================================================
 * महाराष्ट्र पोलीस भरती सराव परीक्षा पोर्टल
 * Supabase कॉन्फिगरेशन आणि डेटा सर्व्हिस (Supabase Config & Data Engine)
 * ====================================================================
 */

// १. डीफॉल्ट Supabase क्रेडेन्शियल्स (येथे तुमची Supabase URL व Anon Key टाका)
// किंवा ॲडमिन पॅनेलमध्ये 'Supabase सेटिंग्ज' मधून थेट ब्राउझरमध्ये सेव्ह करा.
const DEFAULT_SUPABASE_URL = "https://your-project-id.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "your-supabase-anon-key";

// LocalStorage मधून किंवा डीफॉल्टमधून URL व Key मिळवणे
const SUPABASE_URL = localStorage.getItem('pyq_supabase_url') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = localStorage.getItem('pyq_supabase_anon_key') || DEFAULT_SUPABASE_ANON_KEY;

// Supabase क्लायंट इनिशियलाईझ करणे
let supabase = null;
let isSupabaseActive = false;

try {
    if (window.supabase && SUPABASE_URL && !SUPABASE_URL.includes("your-project-id") && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("your-supabase-anon-key")) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });
        isSupabaseActive = true;
        console.log("✅ Supabase क्लायंट सक्रिय झाला आहे.");
    } else {
        console.warn("⚠️ Supabase क्रेडेन्शियल सेटअप केलेले नाहीत किंवा स्थानिक (Local Demo) मोड चालू आहे.");
    }
} catch (err) {
    console.error("Supabase इनिशिएलायझेशन त्रुटी:", err);
    isSupabaseActive = false;
}

// २. सुरक्षित UUID जनरेटर (RFC4122 Compliant - Postgres UUID सुसंगत)
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// सुरक्षित पासवर्ड हॅशिंग (SHA-256 Web Crypto API)
async function hashPassword(plainTextPassword) {
    try {
        const msgBuffer = new TextEncoder().encode(plainTextPassword.trim());
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        // Fallback simple hash for older environments
        let hash = 0;
        for (let i = 0; i < plainTextPassword.length; i++) {
            const char = plainTextPassword.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return "local_hash_" + Math.abs(hash);
    }
}

// ३. लोकल स्टोरेज डेटाबेस मॉडेल (जेव्हा Supabase Anon Key नसेल किंवा ऑफलाइन टेस्टिंगसाठी)
const LOCAL_STORAGE_KEYS = {
    STUDENTS: 'pyq_local_students',
    PAPERS: 'pyq_local_papers',
    QUESTIONS: 'pyq_local_questions',
    ATTEMPTS: 'pyq_local_attempts',
    FLAGS: 'pyq_local_flags',
    CURRENT_USER: 'pyq_user'
};

// डीफॉल्ट नमुना डेटा इनिशियलाईझ करणे
function initLocalDatabase() {
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.STUDENTS)) {
        const defaultAdmin = [{
            id: 'admin-uuid-001',
            full_name: 'मुख्य पोलीस भरती ॲडमिन',
            mobile: '9999999999',
            email: 'admin@policebharti.gov.in',
            bharti_type: 'प्रशासकीय कक्ष',
            password_hash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // admin123
            role: 'admin',
            is_approved: true,
            status: 'approved',
            created_at: new Date().toISOString()
        }];
        localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(defaultAdmin));
    }

    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.PAPERS)) {
        const samplePapers = [
            {
                id: 'paper-uuid-001',
                title: 'महाराष्ट्र पोलीस भरती सराव पेपर - संच ०१ (आदर्श पॅटर्न)',
                description: 'मराठी व्याकरण, अंकगणित, बुद्धिमत्ता व चालू घडामोडी या ४ विषयांवर आधारित परिपूर्ण १०० गुणांचा सराव संच.',
                time_minutes: 90,
                total_marks: 100,
                allow_retake: true,
                shuffle_questions: true,
                show_leaderboard: true,
                is_published: true,
                created_at: new Date().toISOString()
            },
            {
                id: 'paper-uuid-002',
                title: 'SRPF व चालक विशेष सराव पेपर - संच ०२',
                description: 'राज्य राखीव पोलीस बल आणि पोलीस चालक पदांच्या भरतीसाठी विशेष बहुपर्यायी प्रश्न संच.',
                time_minutes: 90,
                total_marks: 100,
                allow_retake: true,
                shuffle_questions: false,
                show_leaderboard: true,
                is_published: true,
                created_at: new Date().toISOString()
            }
        ];
        localStorage.setItem(LOCAL_STORAGE_KEYS.PAPERS, JSON.stringify(samplePapers));
    }

    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.QUESTIONS)) {
        const sampleQuestions = [
            // पेपर १ - मराठी व्याकरण
            {
                id: 'q-001',
                paper_id: 'paper-uuid-001',
                subject: 'मराठी व्याकरण',
                question_text: 'खालीलपैकी कोणता स्वर "संयुक्त स्वर" नाही?',
                option_a: 'ए',
                option_b: 'ऐ',
                option_c: 'ओ',
                option_d: 'ई',
                correct_option: 'D',
                explanation: 'ई हा दीर्घ स्वर आहे; ए, ऐ, ओ, औ हे दोन स्वर एकत्र येऊन तयार झालेले संयुक्त स्वर आहेत.',
                image_url: '',
                question_order: 1
            },
            {
                id: 'q-002',
                paper_id: 'paper-uuid-001',
                subject: 'मराठी व्याकरण',
                question_text: '"वाघाने गाय मारली" या वाक्यातील प्रयोग ओळखा.',
                option_a: 'कर्तरी प्रयोग',
                option_b: 'कर्मणी प्रयोग',
                option_c: 'भावे प्रयोग',
                option_d: 'संकीर्ण प्रयोग',
                correct_option: 'C',
                explanation: 'यात कर्त्याला आणि कर्माला दोघांनाही प्रत्यय लागलेला असल्याने हा भावे प्रयोग आहे.',
                image_url: '',
                question_order: 2
            },
            {
                id: 'q-003',
                paper_id: 'paper-uuid-001',
                subject: 'मराठी व्याकरण',
                question_text: 'खालीलपैकी कोणत्या नामाचे अनेकवचन करताना रूप बदलत नाही?',
                option_a: 'पुस्तक',
                option_b: 'शेतकरी',
                option_c: 'रस्ता',
                option_d: 'घोडा',
                correct_option: 'B',
                explanation: 'शेतकरी या नामाचे एकवचन व अनेकवचन रूप सारखेच राहते (एक शेतकरी / अनेक शेतकरी).',
                image_url: '',
                question_order: 3
            },
            {
                id: 'q-004',
                paper_id: 'paper-uuid-001',
                subject: 'मराठी व्याकरण',
                question_text: '"उंटावरून शेळ्या हाकणे" या म्हणीचा योग्य अर्थ काय?',
                option_a: 'अतिशय मेहनत करणे',
                option_b: 'दुसऱ्याच्या जीवावर मौज करणे',
                option_c: 'दूरवरून काम करण्याची खोटी सवय किंवा निष्काळजीपणे हुकूम देणे',
                option_d: 'प्राण्यांवर प्रेम करणे',
                correct_option: 'C',
                explanation: 'उंटावरून शेळ्या हाकणे म्हणजे कोणतीही मेहनत न करता लांबूनच केवळ हुकूम सोडणे किंवा निष्काळजीपणे कारभार करणे.',
                image_url: '',
                question_order: 4
            },
            // पेपर १ - अंकगणित
            {
                id: 'q-005',
                paper_id: 'paper-uuid-001',
                subject: 'अंकगणित',
                question_text: 'दोन संख्यांचे गुणोत्तर ३:५ असून त्यांची बेरीज २४० आहे, तर त्यांपैकी मोठी संख्या कोणती?',
                option_a: '९०',
                option_b: '१२०',
                option_c: '१५०',
                option_d: '१६०',
                correct_option: 'C',
                explanation: '३x + ५x = २४० => ८x = २४० => x = ३०. मोठी संख्या = ५ * ३० = १५०.',
                image_url: '',
                question_order: 5
            },
            {
                id: 'q-006',
                paper_id: 'paper-uuid-001',
                subject: 'अंकगणित',
                question_text: 'एका वस्तूची खरेदी किंमत ₹५०० असून ती ₹६०० ला विकली, तर शेकडा नफा किती झाला?',
                option_a: '१०%',
                option_b: '१५%',
                option_c: '२०%',
                option_d: '२५%',
                correct_option: 'C',
                explanation: 'नफा = ६०० - ५०० = ₹१००. शेकडा नफा = (१००/५००) * १०० = २०%.',
                image_url: '',
                question_order: 6
            },
            {
                id: 'q-007',
                paper_id: 'paper-uuid-001',
                subject: 'अंकगणित',
                question_text: '१ ते ५० मधील एकूण मूळ संख्या (Prime Numbers) किती आहेत?',
                option_a: '१२',
                option_b: '१५',
                option_c: '१८',
                option_d: '२०',
                correct_option: 'B',
                explanation: '१ ते ५० दरम्यान एकूण १५ मूळ संख्या आहेत (२, ३, ५, ७, ११, १३, १७, १९, २३, २९, ३१, ३७, ४१, ४३, ४७).',
                image_url: '',
                question_order: 7
            },
            // पेपर १ - बुद्धिमत्ता चाचणी
            {
                id: 'q-008',
                paper_id: 'paper-uuid-001',
                subject: 'बुद्धिमत्ता चाचणी',
                question_text: 'संख्या मालिका पूर्ण करा: ४, ९, १६, २५, ३६, ?',
                option_a: '४५',
                option_b: '४९',
                option_c: '५४',
                option_d: '६४',
                correct_option: 'B',
                explanation: 'ही अनुक्रमे २, ३, ४, ५, ६ यांच्या वर्गांची मालिका आहे. पुढील वर्ग ७ चा वर्ग = ४९.',
                image_url: '',
                question_order: 8
            },
            {
                id: 'q-009',
                paper_id: 'paper-uuid-001',
                subject: 'बुद्धिमत्ता चाचणी',
                question_text: 'जर CAT = 24 आणि DOG = 26, तर POLICE = ?',
                option_a: '६०',
                option_b: '६५',
                option_c: '७०',
                option_d: '७५',
                correct_option: 'A',
                explanation: 'P(16) + O(15) + L(12) + I(9) + C(3) + E(5) = १६ + १५ + १२ + ९ + ३ + ५ = ६०.',
                image_url: '',
                question_order: 9
            },
            {
                id: 'q-010',
                paper_id: 'paper-uuid-001',
                subject: 'बुद्धिमत्ता चाचणी',
                question_text: 'घड्याळात ३ वाजून ४० मिनिटे झाली असता तास काटा व मिनिट काटा यांमध्ये किती अंशाचा कोन होईल?',
                option_a: '१२०°',
                option_b: '१३०°',
                option_c: '१४०°',
                option_d: '१२५°',
                correct_option: 'B',
                explanation: 'कोन = |(३० * H) - (११/२ * M)| = |(३० * ३) - (११/२ * ४०)| = |९० - २२०| = १३०°.',
                image_url: '',
                question_order: 10
            },
            // पेपर १ - सामान्य ज्ञान व चालू घडामोडी
            {
                id: 'q-011',
                paper_id: 'paper-uuid-001',
                subject: 'सामान्य ज्ञान व चालू घडामोडी',
                question_text: 'महाराष्ट्र पोलीस दलाचे ब्रीदवाक्य कोणते आहे?',
                option_a: 'सेवा परमो धर्म:',
                option_b: 'सद्रक्षणाय खलनिग्रहणाय',
                option_c: 'सत्यमेव जयते',
                option_d: 'जय हिंद',
                correct_option: 'B',
                explanation: '"सद्रक्षणाय खलनिग्रहणाय" (सज्जनांचे रक्षण आणि दुर्जनांचे निर्दालन) हे महाराष्ट्र पोलिसांचे ब्रीदवाक्य आहे.',
                image_url: '',
                question_order: 11
            },
            {
                id: 'q-012',
                paper_id: 'paper-uuid-001',
                subject: 'सामान्य ज्ञान व चालू घडामोडी',
                question_text: 'महाराष्ट्र पोलीस दलाचे मुख्यालय कोठे आहे?',
                option_a: 'पुणे',
                option_b: 'नागपूर',
                option_c: 'मुंबई',
                option_d: 'नाशिक',
                correct_option: 'C',
                explanation: 'महाराष्ट्र पोलीस मुख्यालयाची मुख्य इमारत कुलाबा, मुंबई येथे स्थित आहे.',
                image_url: '',
                question_order: 12
            },
            {
                id: 'q-013',
                paper_id: 'paper-uuid-001',
                subject: 'सामान्य ज्ञान व चालू घडामोडी',
                question_text: 'महाराष्ट्रातील सर्वात उंच शिखर कोणते आहे?',
                option_a: 'कळसूबाई',
                option_b: 'महाबळेश्वर',
                option_c: 'साल्हेर',
                option_d: 'हरिश्चंद्रगड',
                correct_option: 'A',
                explanation: 'कळसूबाई हे महाराष्ट्रातील सर्वात उंच शिखर असून त्याची उंची १,६४६ मीटर आहे (अहमदनगर जिल्हा).',
                image_url: '',
                question_order: 13
            }
        ];
        localStorage.setItem(LOCAL_STORAGE_KEYS.QUESTIONS, JSON.stringify(sampleQuestions));
    }

    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ATTEMPTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.FLAGS)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.FLAGS, JSON.stringify([]));
    }
}

// ॲप लोड होताच डेटाबेस इनिशियलाईझ करा
initLocalDatabase();

// ४. युजर ऑथेंटिकेशन आणि सेशन व्यवस्थापन
const Auth = {
    // सध्याचा लॉगिन केलेला युजर मिळवणे
    getUser: function() {
        const userStr = localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_USER);
        if (!userStr) return null;
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    },

    // युजर सेव्ह करणे
    setUser: function(user) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    },

    // लॉगआउट करणे
    logout: function() {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_USER);
        window.location.href = 'login.html';
    },

    // पेज ऑथेंटिकेशन गार्ड (विद्यार्थी / ॲडमिन तपासणी)
    protectPage: function(requiredRole = 'student') {
        const user = this.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return null;
        }
        if (requiredRole === 'admin' && user.role !== 'admin') {
            alert('या पानावर जाण्यासाठी ॲडमिन अधिकार आवश्यक आहेत.');
            window.location.href = 'dashboard.html';
            return null;
        }
        return user;
    }
};

// ५. संपूर्ण डेटा सर्व्हिस (Data Engine API)
const DB = {
    // --- विद्यार्थी नोंदणी (ईमेल व्हेरिफिकेशनशिवाय) ---
    registerStudent: async function({ fullName, mobile, email, bhartiType, password }) {
        try {
            const passwordHash = await hashPassword(password);
            const cleanName = fullName.trim();
            const cleanMobile = mobile.trim();
            const cleanEmail = email.trim().toLowerCase();

            if (isSupabaseActive && supabase) {
                try {
                    // १. तपासणी: मोबाईल किंवा ईमेल आधीच आहे का?
                    const { data: existing, error: existErr } = await supabase
                        .from('students')
                        .select('id, mobile, email')
                        .or(`mobile.eq.${cleanMobile},email.eq.${cleanEmail}`);

                    if (existing && existing.length > 0) {
                        if (existing.some(s => s.mobile === cleanMobile)) {
                            return { success: false, message: 'हा मोबाईल नंबर आधीच नोंदणीकृत आहे. कृपया लॉगिन करा.' };
                        }
                        if (existing.some(s => s.email && s.email.toLowerCase() === cleanEmail)) {
                            return { success: false, message: 'हा ईमेल आयडी आधीच नोंदणीकृत आहे.' };
                        }
                    }
                } catch (chkErr) {
                    console.warn("अस्तित्वात तपासणी चेतावणी:", chkErr);
                }

                // २. Supabase इन्सर्ट (id न पाठवता - Postgres आपोआप वैध UUID तयार करतो)
                const insertPayload = {
                    full_name: cleanName,
                    mobile: cleanMobile,
                    email: cleanEmail,
                    bharti_type: bhartiType,
                    password_hash: passwordHash,
                    role: 'student',
                    is_approved: false,
                    status: 'pending'
                };

                const { data, error } = await supabase.from('students').insert([insertPayload]).select();
                if (error) {
                    console.error("Supabase नोंदणी त्रुटी:", error);
                    if (error.code === '23505') {
                        return { success: false, message: 'हा मोबाईल नंबर किंवा ईमेल आयडी आधीच नोंदणीकृत आहे.' };
                    }
                    if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
                        return { success: false, message: 'Supabase मध्ये students टेबल सापडले नाही. कृपया supabase-schema.sql चालवा.' };
                    }
                    return { success: false, message: 'नोंदणी त्रुटी: ' + (error.message || 'डेटाबेस त्रुटी') };
                }

                return { success: true, student: (data && data[0]) ? data[0] : insertPayload };
            }

            // ३. Local Storage Fallback (स्थानिक डेमो मोड)
            const students = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STUDENTS) || '[]');
            if (students.some(s => s.mobile === cleanMobile)) {
                return { success: false, message: 'हा मोबाईल नंबर आधीच नोंदणीकृत आहे. कृपया लॉगिन करा.' };
            }
            if (students.some(s => s.email.toLowerCase() === cleanEmail)) {
                return { success: false, message: 'हा ईमेल आयडी आधीच नोंदणीकृत आहे.' };
            }

            const newStudent = {
                id: generateUUID(),
                full_name: cleanName,
                mobile: cleanMobile,
                email: cleanEmail,
                bharti_type: bhartiType,
                password_hash: passwordHash,
                role: 'student',
                is_approved: false,
                status: 'pending',
                created_at: new Date().toISOString()
            };

            students.push(newStudent);
            localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(students));
            return { success: true, student: newStudent };

        } catch (err) {
            console.error("नोंदणी प्रक्रिया अपवाद:", err);
            return { success: false, message: 'नोंदणी त्रुटी: ' + (err.message || 'तांत्रिक अडचण आली') };
        }
    },

    // --- लॉगिन (मोबाईल / ईमेल + पासवर्ड) ---
    login: async function(identifier, plainPassword) {
        const cleanId = identifier.trim();
        const pwdHash = await hashPassword(plainPassword);

        if (isSupabaseActive) {
            try {
                let query = supabase.from('students').select('*');
                if (/^\d{10}$/.test(cleanId)) {
                    query = query.eq('mobile', cleanId);
                } else {
                    query = query.eq('email', cleanId.toLowerCase());
                }

                const { data, error } = await query;
                if (error) throw error;

                if (!data || data.length === 0) {
                    return { success: false, message: 'नोंदणीकृत खाते सापडले नाही. कृपया नवीन नोंदणी करा.' };
                }

                const student = data[0];
                if (student.password_hash !== pwdHash) {
                    return { success: false, message: 'मोबाईल नंबर किंवा पासवर्ड चुकीचा आहे.' };
                }

                // ॲडमिन असल्यास लगेच लॉगिन
                if (student.role === 'admin') {
                    Auth.setUser(student);
                    return { success: true, user: student, redirectTo: 'admin.html' };
                }

                // विद्यार्थ्याची मंजुरी तपासणी
                if (student.status === 'pending' || !student.is_approved) {
                    return { success: false, message: 'तुमचे खाते अजून ॲडमिनने मंजूर केलेले नाही. कृपया मंजुरीची वाट पहा.' };
                }
                if (student.status === 'rejected') {
                    return { success: false, message: 'तुमची नोंदणी ॲडमिनने रद्द (Reject) केली आहे. अधिक माहितीसाठी प्रशासकाशी संपर्क साधा.' };
                }
                if (student.status === 'deactivated') {
                    return { success: false, message: 'तुमचे खाते तात्पुरते बंद (Deactivate) करण्यात आले आहे.' };
                }

                Auth.setUser(student);
                return { success: true, user: student, redirectTo: 'dashboard.html' };
            } catch (err) {
                console.warn("Supabase लॉगिन अयशस्वी, स्थानिक डेटा तपासत आहे:", err);
            }
        }

        // Local Storage Fallback
        const students = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STUDENTS) || '[]');
        const student = students.find(s => s.mobile === cleanId || s.email.toLowerCase() === cleanId.toLowerCase());

        if (!student) {
            return { success: false, message: 'नोंदणीकृत खाते सापडले नाही. कृपया नवीन नोंदणी करा.' };
        }

        if (student.password_hash !== pwdHash) {
            return { success: false, message: 'मोबाईल नंबर किंवा पासवर्ड चुकीचा आहे.' };
        }

        if (student.role === 'admin') {
            Auth.setUser(student);
            return { success: true, user: student, redirectTo: 'admin.html' };
        }

        if (student.status === 'pending' || !student.is_approved) {
            return { success: false, message: 'तुमचे खाते अजून ॲडमिनने मंजूर केलेले नाही. कृपया मंजुरीची वाट पहा.' };
        }
        if (student.status === 'rejected') {
            return { success: false, message: 'तुमची नोंदणी ॲडमिनने रद्द (Reject) केली आहे.' };
        }
        if (student.status === 'deactivated') {
            return { success: false, message: 'तुमचे खाते तात्पुरते बंद (Deactivate) करण्यात आले आहे.' };
        }

        Auth.setUser(student);
        return { success: true, user: student, redirectTo: 'dashboard.html' };
    },

    // --- थेट पासवर्ड रीसेट: मोबाईल व ईमेल पडताळणी ---
    verifyMobileEmail: async function(mobile, email) {
        const cleanMobile = mobile.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (isSupabaseActive) {
            try {
                const { data, error } = await supabase
                    .from('students')
                    .select('id, full_name, mobile, email')
                    .eq('mobile', cleanMobile)
                    .eq('email', cleanEmail);
                if (error) throw error;
                return (data && data.length > 0);
            } catch (err) {
                console.error("Supabase पडताळणी त्रुटी:", err);
            }
        }

        const students = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STUDENTS) || '[]');
        return students.some(s => s.mobile === cleanMobile && s.email.toLowerCase() === cleanEmail);
    },

    // --- थेट पासवर्ड बदलणे ---
    resetPassword: async function(mobile, email, newPassword) {
        const cleanMobile = mobile.trim();
        const cleanEmail = email.trim().toLowerCase();
        const newHash = await hashPassword(newPassword);

        if (isSupabaseActive) {
            try {
                const { data, error } = await supabase
                    .from('students')
                    .update({ password_hash: newHash, updated_at: new Date().toISOString() })
                    .eq('mobile', cleanMobile)
                    .eq('email', cleanEmail)
                    .select();
                if (error) throw error;
                if (data && data.length > 0) return { success: true };
            } catch (err) {
                console.error("Supabase पासवर्ड रीसेट त्रुटी:", err);
            }
        }

        const students = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STUDENTS) || '[]');
        const idx = students.findIndex(s => s.mobile === cleanMobile && s.email.toLowerCase() === cleanEmail);
        if (idx !== -1) {
            students[idx].password_hash = newHash;
            students[idx].updated_at = new Date().toISOString();
            localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(students));
            return { success: true };
        }

        return { success: false, message: 'माहिती जुळली नाही.' };
    },

    // --- ॲडमिन: सर्व विद्यार्थी मिळवणे ---
    getAllStudents: async function() {
        if (isSupabaseActive) {
            try {
                const { data, error } = await supabase
                    .from('students')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return data || [];
            } catch (err) {
                console.warn("Supabase fetch student fallback:", err);
            }
        }
        return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STUDENTS) || '[]');
    },

    // --- ॲडमिन: विद्यार्थी स्थिती बदलणे (मंजूर / रद्द / बंद) ---
    updateStudentStatus: async function(studentId, newStatus) {
        const isApproved = (newStatus === 'approved');
        if (isSupabaseActive) {
            try {
                const { data, error } = await supabase
                    .from('students')
                    .update({ status: newStatus, is_approved: isApproved, updated_at: new Date().toISOString() })
                    .eq('id', studentId)
                    .select();
                if (error) throw error;
                return { success: true };
            } catch (err) {
                console.error("Supabase स्थिती बदल त्रुटी:", err);
            }
        }

        const students = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STUDENTS) || '[]');
        const target = students.find(s => s.id === studentId);
        if (target) {
            target.status = newStatus;
            target.is_approved = isApproved;
            target.updated_at = new Date().toISOString();
            localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(students));
            return { success: true };
        }
        return { success: false, message: 'विद्यार्थी सापडला नाही.' };
    },

    // --- ॲडमिन: विद्यार्थी हटवणे ---
    deleteStudent: async function(studentId) {
        if (isSupabaseActive) {
            try {
                const { error } = await supabase.from('students').delete().eq('id', studentId);
                if (error) throw error;
                return { success: true };
            } catch (err) {
                console.error("Supabase Delete Student Error:", err);
            }
        }
        let students = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STUDENTS) || '[]');
        students = students.filter(s => s.id !== studentId);
        localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        return { success: true };
    },

    // --- पेपर्स व्यवस्थापन (Papers Management) ---
    getPapers: async function(onlyPublished = false) {
        let papers = [];
        if (isSupabaseActive) {
            try {
                let query = supabase.from('papers').select('*').order('created_at', { ascending: false });
                if (onlyPublished) query = query.eq('is_published', true);
                const { data, error } = await query;
                if (error) throw error;
                papers = data || [];
            } catch (err) {
                console.warn("Supabase fetch papers fallback:", err);
                papers = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.PAPERS) || '[]');
            }
        } else {
            papers = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.PAPERS) || '[]');
        }

        if (onlyPublished) {
            papers = papers.filter(p => p.is_published);
        }

        // प्रत्येक पेपरमधील प्रश्नांची संख्या मोजणे
        const questions = await this.getAllQuestions();
        return papers.map(paper => {
            const paperQuestions = questions.filter(q => q.paper_id === paper.id);
            const subjectsCount = {
                'मराठी व्याकरण': paperQuestions.filter(q => q.subject === 'मराठी व्याकरण').length,
                'अंकगणित': paperQuestions.filter(q => q.subject === 'अंकगणित').length,
                'बुद्धिमत्ता चाचणी': paperQuestions.filter(q => q.subject === 'बुद्धिमत्ता चाचणी').length,
                'सामान्य ज्ञान व चालू घडामोडी': paperQuestions.filter(q => q.subject === 'सामान्य ज्ञान व चालू घडामोडी').length
            };
            return {
                ...paper,
                total_questions: paperQuestions.length,
                subjects_count: subjectsCount
            };
        });
    },

    // पेपर माहिती मिळवणे
    getPaperById: async function(paperId) {
        const papers = await this.getPapers(false);
        return papers.find(p => p.id === paperId) || null;
    },

    // नवीन पेपर तयार करणे किंवा अपडेट करणे
    savePaper: async function(paperData) {
        const isNew = !paperData.id;
        const paperId = paperData.id || generateUUID();
        const record = {
            id: paperId,
            title: paperData.title.trim(),
            description: paperData.description || '',
            time_minutes: parseInt(paperData.time_minutes) || 90,
            total_marks: parseInt(paperData.total_marks) || 100,
            allow_retake: Boolean(paperData.allow_retake),
            shuffle_questions: Boolean(paperData.shuffle_questions),
            show_leaderboard: Boolean(paperData.show_leaderboard),
            is_published: paperData.is_published !== undefined ? Boolean(paperData.is_published) : true,
            updated_at: new Date().toISOString()
        };
        if (isNew) record.created_at = new Date().toISOString();

        if (isSupabaseActive && supabase) {
            try {
                const { data, error } = isNew
                    ? await supabase.from('papers').insert([record]).select()
                    : await supabase.from('papers').update(record).eq('id', paperId).select();
                if (error) throw error;
                return { success: true, paper: data ? data[0] : record };
            } catch (err) {
                console.error("Supabase Save Paper Error:", err);
            }
        }

        const papers = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.PAPERS) || '[]');
        if (isNew) {
            papers.push(record);
        } else {
            const idx = papers.findIndex(p => p.id === record.id);
            if (idx !== -1) papers[idx] = { ...papers[idx], ...record };
            else papers.push(record);
        }
        localStorage.setItem(LOCAL_STORAGE_KEYS.PAPERS, JSON.stringify(papers));
        return { success: true, paper: record };
    },

    // पेपर आणि त्याचे सर्व प्रश्न हटवणे (Delete Paper)
    deletePaper: async function(paperId) {
        if (isSupabaseActive && supabase) {
            try {
                // कॅस्केडमुळे संबंधित प्रश्न आणि attempts डिलीट होतील
                const { error } = await supabase.from('papers').delete().eq('id', paperId);
                if (error) throw error;
                return { success: true };
            } catch (err) {
                console.error("Supabase Delete Paper Error:", err);
            }
        }

        let papers = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.PAPERS) || '[]');
        papers = papers.filter(p => p.id !== paperId);
        localStorage.setItem(LOCAL_STORAGE_KEYS.PAPERS, JSON.stringify(papers));

        let questions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.QUESTIONS) || '[]');
        questions = questions.filter(q => q.paper_id !== paperId);
        localStorage.setItem(LOCAL_STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));

        let attempts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS) || '[]');
        attempts = attempts.filter(a => a.paper_id !== paperId);
        localStorage.setItem(LOCAL_STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));

        return { success: true };
    },

    // सर्व प्रश्न मिळवणे
    getAllQuestions: async function() {
        if (isSupabaseActive && supabase) {
            try {
                const { data, error } = await supabase.from('questions').select('*').order('question_order', { ascending: true });
                if (error) throw error;
                return data || [];
            } catch (err) {
                console.warn("Supabase fetch all questions fallback:", err);
            }
        }
        return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.QUESTIONS) || '[]');
    },

    // विशिष्ट पेपरचे प्रश्न मिळवणे
    getQuestionsForPaper: async function(paperId, hideCorrectAnswer = false) {
        let questions = [];
        if (isSupabaseActive && supabase) {
            try {
                const { data, error } = await supabase
                    .from('questions')
                    .select('*')
                    .eq('paper_id', paperId)
                    .order('question_order', { ascending: true });
                if (error) throw error;
                questions = data || [];
            } catch (err) {
                console.warn("Supabase get questions fallback:", err);
                const all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.QUESTIONS) || '[]');
                questions = all.filter(q => q.paper_id === paperId);
            }
        } else {
            const all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.QUESTIONS) || '[]');
            questions = all.filter(q => q.paper_id === paperId);
        }

        if (hideCorrectAnswer) {
            // सुरक्षित परीक्षा मोड: बरोबर उत्तरे आणि स्पष्टीकरण क्लायंटला पाठवायचे नाही!
            return questions.map(q => ({
                id: q.id,
                paper_id: q.paper_id,
                subject: q.subject,
                question_text: q.question_text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                image_url: q.image_url,
                question_order: q.question_order
            }));
        }

        return questions;
    },

    // प्रश्न तयार किंवा अपडेट करणे
    saveQuestion: async function(qData) {
        const isNew = !qData.id;
        const qId = qData.id || generateUUID();
        const record = {
            id: qId,
            paper_id: qData.paper_id,
            subject: qData.subject || 'सामान्य ज्ञान व चालू घडामोडी',
            question_text: qData.question_text.trim(),
            option_a: qData.option_a.trim(),
            option_b: qData.option_b.trim(),
            option_c: qData.option_c.trim(),
            option_d: qData.option_d.trim(),
            correct_option: qData.correct_option.trim().toUpperCase(),
            explanation: qData.explanation ? qData.explanation.trim() : '',
            image_url: qData.image_url || '',
            question_order: parseInt(qData.question_order) || 1,
            created_at: new Date().toISOString()
        };

        if (isSupabaseActive && supabase) {
            try {
                const { data, error } = isNew
                    ? await supabase.from('questions').insert([record]).select()
                    : await supabase.from('questions').update(record).eq('id', qId).select();
                if (error) throw error;
                return { success: true, question: data ? data[0] : record };
            } catch (err) {
                console.error("Supabase Save Question Error:", err);
            }
        }

        const questions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.QUESTIONS) || '[]');
        if (isNew) {
            questions.push(record);
        } else {
            const idx = questions.findIndex(q => q.id === record.id);
            if (idx !== -1) questions[idx] = { ...questions[idx], ...record };
            else questions.push(record);
        }
        localStorage.setItem(LOCAL_STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
        return { success: true, question: record };
    },

    // प्रश्न हटवणे
    deleteQuestion: async function(questionId) {
        if (isSupabaseActive && supabase) {
            try {
                const { error } = await supabase.from('questions').delete().eq('id', questionId);
                if (error) throw error;
                return { success: true };
            } catch (err) {
                console.error("Supabase Delete Question Error:", err);
            }
        }

        let questions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.QUESTIONS) || '[]');
        questions = questions.filter(q => q.id !== questionId);
        localStorage.setItem(LOCAL_STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
        return { success: true };
    },

    // CSV मधून एकाच वेळी अनेक प्रश्न सेव्ह करणे
    importQuestionsBatch: async function(paperId, questionsList) {
        const records = questionsList.map((q, idx) => ({
            id: generateUUID(),
            paper_id: paperId,
            subject: q.subject || 'मराठी व्याकरण',
            question_text: q.question_text || '',
            option_a: q.option_a || '',
            option_b: q.option_b || '',
            option_c: q.option_c || '',
            option_d: q.option_d || '',
            correct_option: (q.correct_option || 'A').toUpperCase().trim(),
            explanation: q.explanation || '',
            image_url: q.image_url || '',
            question_order: idx + 1,
            created_at: new Date().toISOString()
        }));

        if (isSupabaseActive && supabase) {
            try {
                const { data, error } = await supabase.from('questions').insert(records).select();
                if (error) throw error;
                // विद्यार्थ्यांच्या पानावर लगेच दिसावा म्हणून पेपर आपोआप पब्लिश करणे
                await supabase.from('papers').update({ is_published: true }).eq('id', paperId);
                return { success: true, count: data ? data.length : records.length };
            } catch (err) {
                console.error("Supabase Batch Insert Error:", err);
                return { success: false, message: err.message };
            }
        }

        const questions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.QUESTIONS) || '[]');
        questions.push(...records);
        localStorage.setItem(LOCAL_STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));

        // स्थानिक पेपरही पब्लिश करणे
        const papers = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.PAPERS) || '[]');
        const pIdx = papers.findIndex(p => p.id === paperId);
        if (pIdx !== -1) {
            papers[pIdx].is_published = true;
            localStorage.setItem(LOCAL_STORAGE_KEYS.PAPERS, JSON.stringify(papers));
        }

        return { success: true, count: records.length };
    },

    // --- परीक्षा सबमिशन व सुरक्षित गुण मोजणी ---
    submitExamAttempt: async function(studentId, paperId, answers, timeTakenSeconds) {
        // पेपरचे संपूर्ण मूळ प्रश्न (बरोबर उत्तरांसहित) डेटाबेसमधून घेणे
        const fullQuestions = await this.getQuestionsForPaper(paperId, false);

        let totalQuestions = fullQuestions.length;
        let correctCount = 0;
        let wrongCount = 0;
        let unattemptedCount = 0;
        const subjectAnalysis = {};

        fullQuestions.forEach(q => {
            const sub = q.subject || 'इतर';
            if (!subjectAnalysis[sub]) {
                subjectAnalysis[sub] = { total: 0, correct: 0, wrong: 0, unattempted: 0 };
            }
            subjectAnalysis[sub].total++;

            const studentChoice = answers[q.id];
            if (!studentChoice) {
                unattemptedCount++;
                subjectAnalysis[sub].unattempted++;
            } else if (studentChoice.toUpperCase().trim() === q.correct_option.toUpperCase().trim()) {
                correctCount++;
                subjectAnalysis[sub].correct++;
            } else {
                wrongCount++;
                subjectAnalysis[sub].wrong++;
            }
        });

        const totalScore = correctCount; // १ गुण प्रति बरोबर उत्तर
        const percentage = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(2)) : 0;

        const attemptRecord = {
            id: generateUUID(),
            student_id: studentId,
            paper_id: paperId,
            total_questions: totalQuestions,
            correct_count: correctCount,
            wrong_count: wrongCount,
            unattempted_count: unattemptedCount,
            total_score: totalScore,
            percentage: percentage,
            time_taken_seconds: timeTakenSeconds,
            answers_json: answers,
            subject_analysis_json: subjectAnalysis,
            created_at: new Date().toISOString()
        };

        if (isSupabaseActive && supabase) {
            try {
                const { data, error } = await supabase.from('attempts').insert([attemptRecord]).select();
                if (error) throw error;
                return { success: true, attempt: data ? data[0] : attemptRecord };
            } catch (err) {
                console.error("Supabase Submit Attempt Error:", err);
            }
        }

        const attempts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS) || '[]');
        attempts.push(attemptRecord);
        localStorage.setItem(LOCAL_STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
        return { success: true, attempt: attemptRecord };
    },
            student_id: studentId,
            paper_id: paperId,
            total_questions: totalQuestions,
            correct_count: correctCount,
            wrong_count: wrongCount,
            unattempted_count: unattemptedCount,
            total_score: totalScore,
            percentage: percentage,
            time_taken_seconds: timeTakenSeconds,
            answers_json: answers,
            subject_analysis_json: subjectAnalysis,
            created_at: new Date().toISOString()
        };

        if (isSupabaseActive) {
            try {
                const { data, error } = await supabase.from('attempts').insert([attemptRecord]).select();
                if (error) throw error;
                return { success: true, attempt: data[0] };
            } catch (err) {
                console.error("Supabase Submit Attempt Error:", err);
            }
        }

        const attempts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS) || '[]');
        attempts.push(attemptRecord);
        localStorage.setItem(LOCAL_STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
        return { success: true, attempt: attemptRecord };
    },

    // विशिष्ट निकालाची माहिती (Attempt Details with Paper & Questions)
    getAttemptById: async function(attemptId) {
        let attempt = null;
        if (isSupabaseActive) {
            try {
                const { data, error } = await supabase.from('attempts').select('*').eq('id', attemptId);
                if (error) throw error;
                if (data && data.length > 0) attempt = data[0];
            } catch (err) {
                console.warn("Supabase fetch attempt fallback:", err);
            }
        }

        if (!attempt) {
            const attempts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS) || '[]');
            attempt = attempts.find(a => a.id === attemptId);
        }

        if (!attempt) return null;

        const paper = await this.getPaperById(attempt.paper_id);
        const questions = await this.getQuestionsForPaper(attempt.paper_id, false);
        const students = await this.getAllStudents();
        const student = students.find(s => s.id === attempt.student_id);

        return {
            ...attempt,
            paper: paper,
            student: student,
            questions: questions
        };
    },

    // विद्यार्थ्याचे सर्व सोडवलेले पेपर्स मिळवणे
    getStudentAttempts: async function(studentId) {
        let attempts = [];
        if (isSupabaseActive) {
            try {
                const { data, error } = await supabase
                    .from('attempts')
                    .select('*')
                    .eq('student_id', studentId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                attempts = data || [];
            } catch (err) {
                console.warn("Supabase fetch student attempts fallback:", err);
                const all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS) || '[]');
                attempts = all.filter(a => a.student_id === studentId);
            }
        } else {
            const all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS) || '[]');
            attempts = all.filter(a => a.student_id === studentId);
        }

        const papers = await this.getPapers(false);
        return attempts.map(att => ({
            ...att,
            paper: papers.find(p => p.id === att.paper_id) || { title: 'सराव पेपर' }
        }));
    },

    // लीडरबोर्ड / गुणवत्ता यादी (विशिष्ट पेपरसाठी रँकिंग)
    getPaperLeaderboard: async function(paperId) {
        let attempts = [];
        if (isSupabaseActive) {
            try {
                const { data, error } = await supabase
                    .from('attempts')
                    .select('*, students(full_name, bharti_type)')
                    .eq('paper_id', paperId)
                    .order('total_score', { ascending: false })
                    .order('time_taken_seconds', { ascending: true });
                if (error) throw error;
                attempts = data || [];
            } catch (err) {
                const all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS) || '[]');
                attempts = all.filter(a => a.paper_id === paperId);
            }
        } else {
            const all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS) || '[]');
            attempts = all.filter(a => a.paper_id === paperId);
        }

        const students = await this.getAllStudents();
        return attempts
            .sort((a, b) => b.total_score - a.total_score || a.time_taken_seconds - b.time_taken_seconds)
            .map((att, index) => {
                const st = students.find(s => s.id === att.student_id);
                return {
                    rank: index + 1,
                    student_name: st ? st.full_name : 'परीक्षार्थी',
                    bharti_type: st ? st.bharti_type : '-',
                    total_score: att.total_score,
                    percentage: att.percentage,
                    time_taken: att.time_taken_seconds,
                    created_at: att.created_at
                };
            });
    },

    // --- प्रश्नावर चूक / शंका नोंदवणे (Report Error / Flag Question) ---
    flagQuestion: async function({ questionId, studentId, paperId, reason, details }) {
        const flagRecord = {
            id: 'flg-' + Date.now(),
            question_id: questionId,
            student_id: studentId,
            paper_id: paperId,
            reason: reason,
            details: details || '',
            status: 'pending',
            created_at: new Date().toISOString()
        };

        if (isSupabaseActive) {
            try {
                const { data, error } = await supabase.from('question_flags').insert([flagRecord]).select();
                if (error) throw error;
                return { success: true, flag: data[0] };
            } catch (err) {
                console.error("Supabase Flag Error:", err);
            }
        }

        const flags = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.FLAGS) || '[]');
        flags.push(flagRecord);
        localStorage.setItem(LOCAL_STORAGE_KEYS.FLAGS, JSON.stringify(flags));
        return { success: true, flag: flagRecord };
    },

    // सर्व शंका मिळवणे (ॲडमिनसाठी)
    getFlags: async function() {
        let flags = [];
        if (isSupabaseActive) {
            try {
                const { data, error } = await supabase.from('question_flags').select('*').order('created_at', { ascending: false });
                if (error) throw error;
                flags = data || [];
            } catch (err) {
                flags = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.FLAGS) || '[]');
            }
        } else {
            flags = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.FLAGS) || '[]');
        }

        const questions = await this.getAllQuestions();
        const students = await this.getAllStudents();
        const papers = await this.getPapers(false);

        return flags.map(f => ({
            ...f,
            question: questions.find(q => q.id === f.question_id) || { question_text: 'हटवलेला प्रश्न' },
            student: students.find(s => s.id === f.student_id) || { full_name: 'अनोळखी', mobile: '-' },
            paper: papers.find(p => p.id === f.paper_id) || { title: 'सराव पेपर' }
        }));
    },

    // शंका सोडवली म्हणून मार्क करणे
    resolveFlag: async function(flagId) {
        if (isSupabaseActive) {
            try {
                await supabase.from('question_flags').update({ status: 'resolved' }).eq('id', flagId);
                return { success: true };
            } catch (err) {
                console.error("Resolve flag error:", err);
            }
        }

        const flags = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.FLAGS) || '[]');
        const target = flags.find(f => f.id === flagId);
        if (target) target.status = 'resolved';
        localStorage.setItem(LOCAL_STORAGE_KEYS.FLAGS, JSON.stringify(flags));
        return { success: true };
    },

    // --- ॲडमिन डॅशबोर्ड आकडेवारी (5 Key Stats) ---
    getDashboardStats: async function() {
        const students = await this.getAllStudents();
        const papers = await this.getPapers(false);
        const flags = await this.getFlags();
        
        let attemptsCount = 0;
        if (isSupabaseActive) {
            try {
                const { count } = await supabase.from('attempts').select('*', { count: 'exact', head: true });
                attemptsCount = count || 0;
            } catch (e) {
                const attempts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS) || '[]');
                attemptsCount = attempts.length;
            }
        } else {
            const attempts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ATTEMPTS) || '[]');
            attemptsCount = attempts.length;
        }

        return {
            total_students: students.filter(s => s.role !== 'admin').length,
            pending_approvals: students.filter(s => s.role !== 'admin' && (s.status === 'pending' || !s.is_approved)).length,
            total_papers: papers.length,
            total_attempts: attemptsCount,
            pending_flags: flags.filter(f => f.status === 'pending').length
        };
    }
};

// ६. ब्राउझर इमेज ऑटो-कॉम्प्रेस फंक्शन (WebP / JPEG ~40-80 KB)
async function compressImageToDataUrl(file, maxWidth = 900, maxHeight = 700, quality = 0.75) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error("कृपया योग्य इमेज फाईल निवडा."));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // WebP कॉम्प्रेस किंवा JPEG
                let compressedDataUrl = canvas.toDataURL('image/webp', quality);
                if (compressedDataUrl.indexOf('data:image/webp') !== 0) {
                    compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                resolve({
                    dataUrl: compressedDataUrl,
                    width: width,
                    height: height,
                    estimatedSizeKb: Math.round(compressedDataUrl.length * (3 / 4) / 1024)
                });
            };
            img.onerror = () => reject(new Error("इमेज लोड करण्यात अडचण आली."));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("फाईल वाचता आली नाही."));
        reader.readAsDataURL(file);
    });
}

// जागतिक स्तरावर उपलब्ध करणे
window.DB = DB;
window.Auth = Auth;
window.hashPassword = hashPassword;
window.compressImageToDataUrl = compressImageToDataUrl;
window.isSupabaseActive = isSupabaseActive;
