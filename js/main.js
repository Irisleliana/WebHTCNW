

// Tìm đường dẫn tới thư mục gốc project dựa trên vị trí file /js/main.js
function getBasePath() {
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
        if (script.src && script.src.includes('main.js')) {
            const scriptPath = script.src;
            const jsIndex = scriptPath.lastIndexOf('/js/main.js');
            if (jsIndex !== -1) {
                return scriptPath.substring(0, jsIndex);
            }
        }
    }
    return '.';
}

// Giữ tên hàm cũ để các phần còn lại dùng thống nhất
function getRootPath() {
    return getBasePath();
}

// Tải một tập lệnh chỉ một lần
function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const existing = Array.from(document.querySelectorAll('script[data-drinkhub-src]'))
            .find(script => script.dataset.drinkhubSrc === src);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }

            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Failed to load script: ' + src)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.dataset.drinkhubSrc = src;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => reject(new Error('Failed to load script: ' + src)), { once: true });
        document.head.appendChild(script);
    });
}

// Tải một tập lệnh nếu nó tồn tại
async function loadOptionalScript(src) {
    try {
        const res = await fetch(src, { method: 'GET' });
        if (!res.ok) {
            return false;
        }
        await loadScriptOnce(src);
        return true;
    } catch {
        return false;
    }
}

// Phần Firebase 
function getFirebaseConfig() {
    const cfg = window.DRINKHUB_FIREBASE_CONFIG;
    if (!cfg || typeof cfg !== 'object') {
        return null;
    }

    const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const missing = required.filter(key => !String(cfg[key] || '').trim());
    if (missing.length) {
        return null;
    }

    return cfg;
}

async function ensureFirebaseLoaded() {
    const basePath = getBasePath();
    await loadOptionalScript(basePath + '/js/firebase-config.js');

    const cfg = getFirebaseConfig();
    if (!cfg) {
        return { enabled: false, reason: 'missing-config' };
    }

    const version = '10.12.4';
    const appSrc = `https://www.gstatic.com/firebasejs/${version}/firebase-app-compat.js`;
    const authSrc = `https://www.gstatic.com/firebasejs/${version}/firebase-auth-compat.js`;
    const firestoreSrc = `https://www.gstatic.com/firebasejs/${version}/firebase-firestore-compat.js`;

    await loadScriptOnce(appSrc);
    await loadScriptOnce(authSrc);
    await loadScriptOnce(firestoreSrc);

    if (!window.firebase) {
        return { enabled: false, reason: 'sdk-not-loaded' };
    }

    if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(cfg);
    }

    return { enabled: true };
}

// Ánh xạ lỗi xác thực Firebase thành thông báo thân thiện với người dùng
function mapFirebaseAuthError(error) {
    const code = String(error?.code || '');
    switch (code) {
        case 'auth/configuration-not-found':
            return 'Firebase Authentication is not configured. Enable Email/Password in Firebase Console → Authentication → Sign-in method.';
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Invalid email or password.';
        case 'auth/operation-not-allowed':
            return 'This sign-in method is not enabled. Enable Email/Password in Firebase Console → Authentication → Sign-in method.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/email-already-in-use':
            return 'This email is already in use. Please log in.';
        case 'auth/weak-password':
            return 'Weak password.';
        case 'auth/network-request-failed':
            return 'Network error. Please try again.';
        default:
            return error?.message || 'An error occurred. Please try again.';
    }
}

//Phần Người dùng 
function getUserDisplayName(user) {
    return (user?.displayName || '').trim() || (user?.email || '').trim() || 'Account';
}


function setHeaderAuthUI(user) {
    const accountButton = document.querySelector('.main-header .user-account');
    const nameSpan = document.querySelector('.main-header .user-account .user-name');
    if (!accountButton || !nameSpan) {
        return;
    }

    const rootPath = getRootPath();
    const userPageUrl = rootPath + '/html/userPage.html';

    if (accountButton._drinkhubClickHandler) {
        accountButton.removeEventListener('click', accountButton._drinkhubClickHandler);
        accountButton._drinkhubClickHandler = null;
    }

    if (!user) {
        nameSpan.textContent = 'Log in';
        accountButton.setAttribute('data-bs-toggle', 'modal');
        accountButton.setAttribute('data-bs-target', '#authModal');
        accountButton.setAttribute('aria-label', 'Log in');
        return;
    }

    nameSpan.textContent = getUserDisplayName(user);
    accountButton.removeAttribute('data-bs-toggle');
    accountButton.removeAttribute('data-bs-target');
    accountButton.setAttribute('aria-label', 'Account');

    const handler = event => {
        event.preventDefault();
        window.location.href = userPageUrl;
    };
    accountButton._drinkhubClickHandler = handler;
    accountButton.addEventListener('click', handler);
}

// Điền thông tin người dùng trên trang người dùng
async function populateUserPage(user) {
    const currentPath = window.location.pathname.replace(/\\/g, '/');
    if (!currentPath.endsWith('/html/userPage.html')) {
        return;
    }

    const nameEl = document.getElementById('userPageName');
    const greetingEl = document.getElementById('userPageGreetingName');
    const fullNameInput = document.getElementById('profileFullNameInput');
    const phoneInput = document.getElementById('profilePhoneInput');

    const displayName = getUserDisplayName(user);
    if (nameEl) {
        nameEl.textContent = displayName;
    }
    if (greetingEl) {
        greetingEl.textContent = displayName;
    }
    if (fullNameInput && !fullNameInput.value) {
        fullNameInput.value = user.displayName || '';
    }

    // Firestore profile (if available)
    try {
        const db = firebase.firestore();
        const snap = await db.collection('users').doc(user.uid).get();
        const data = snap.exists ? snap.data() : null;
        if (data) {
            if (fullNameInput) {
                fullNameInput.value = data.fullName || fullNameInput.value;
            }
            if (phoneInput) {
                phoneInput.value = data.phone || phoneInput.value;
            }
        }
    } catch (err) {
        console.warn('Failed to read user profile from Firestore:', err);
    }

    // Logout
    const logoutLink = document.getElementById('userLogoutLink');
    if (logoutLink && !logoutLink.dataset.bound) {
        logoutLink.dataset.bound = 'true';
        logoutLink.addEventListener('click', async event => {
            event.preventDefault();
            try {
                await firebase.auth().signOut();
                window.location.href = getRootPath() + '/index.html';
            } catch (err) {
                alert(mapFirebaseAuthError(err));
            }
        });
    }

    // Update basic profile
    const updateBtn = document.getElementById('profileUpdateBtn');
    if (updateBtn && !updateBtn.dataset.bound) {
        updateBtn.dataset.bound = 'true';
        updateBtn.addEventListener('click', async () => {
            const fullName = (fullNameInput?.value || '').trim();
            const phone = (phoneInput?.value || '').trim();

            const errors = [];
            if (!fullName) {
                errors.push('Please enter your full name.');
            }
            if (phone && !/^(?:08|09|03|07|05)\d{8}$/.test(phone)) {
                errors.push('Phone number is not valid.');
            }
            if (errors.length) {
                alert(errors.join('\n'));
                return;
            }

            try {
                await user.updateProfile({ displayName: fullName });
                await firebase.firestore().collection('users').doc(user.uid).set(
                    {
                        fullName,
                        phone,
                        email: user.email || '',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    { merge: true }
                );
                alert('Profile updated successfully.');
                setHeaderAuthUI(firebase.auth().currentUser);
                if (nameEl) {
                    nameEl.textContent = fullName;
                }
                if (greetingEl) {
                    greetingEl.textContent = fullName;
                }
            } catch (err) {
                alert(mapFirebaseAuthError(err));
            }
        });
    }
}


function updateNavLinks() {
    const rootPath = getRootPath();
    const navLinks = document.querySelectorAll('[data-href]');
    navLinks.forEach(link => {
        const dataHref = link.getAttribute('data-href');
        if (dataHref) {
            link.href = rootPath + '/' + dataHref;
        }
    });
}


function updateActiveHeaderLink() {
    const currentPath = window.location.pathname.replace(/\\/g, '/');
    const headerLinks = document.querySelectorAll('.nav-links .nav-link');

    headerLinks.forEach(link => {
        link.classList.remove('active');
        const dataHref = link.getAttribute('data-href');
        if (dataHref && currentPath.endsWith(dataHref)) {
            link.classList.add('active');
        }
    });
}

// Get detail page URL
function getDetailPageUrl(card) {
    const rootPath = getRootPath();
    const nameElement = card.querySelector('.cafe-name');
    const ratingElement = card.querySelector('.cafe-rating');
    const reviewElement = card.querySelector('.cafe-badge');
    const deliveryElement = card.querySelector('.delivery-badge');

    const name = nameElement ? nameElement.textContent.trim() : 'DrinkHub Cafe';
    const ratingText = ratingElement ? ratingElement.textContent.trim() : '4.5';
    const rating = ratingText.replace(/[^0-9.]/g, '') || '4.5';
    const reviews = reviewElement ? reviewElement.textContent.replace(/\D/g, '') : '0';
    const delivery = deliveryElement ? deliveryElement.textContent.trim() : 'Fast delivery';

    const params = new URLSearchParams({
        name,
        rating,
        reviews,
        delivery
    });

    return rootPath + '/html/detailPage.html?' + params.toString();
}

function attachCafeCardNavigation() {
    const cards = document.querySelectorAll('.cafe-card');
    if (!cards.length) {
        return;
    }

    cards.forEach(card => {
      
        if (card.getAttribute('onclick')) {
            return;
        }

        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        card.addEventListener('click', () => {
            window.location.href = getDetailPageUrl(card);
        });

        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                window.location.href = getDetailPageUrl(card);
            }
        });
    });
}


function initDetailPageData() {
    const detailSection = document.getElementById('detail-page-content');
    if (!detailSection) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const name = params.get('name') || 'DrinkHub Cafe';
    const rating = params.get('rating') || '4.5';
    const reviews = params.get('reviews') || '0';
    const delivery = params.get('delivery') || 'Fast delivery';

    const nameElement = document.getElementById('detail-cafe-name');
    const ratingElement = document.getElementById('detail-cafe-rating');
    const reviewElement = document.getElementById('detail-cafe-reviews');
    const deliveryElement = document.getElementById('detail-cafe-delivery');
    const titleElement = document.getElementById('detail-page-title');

    if (nameElement) {
        nameElement.textContent = name;
    }
    if (ratingElement) {
        ratingElement.textContent = rating;
    }
    if (reviewElement) {
        reviewElement.textContent = reviews;
    }
    if (deliveryElement) {
        deliveryElement.textContent = delivery;
    }
    if (titleElement) {
        titleElement.textContent = 'Detail - ' + name;
    }
}


async function attachAuthModalValidation() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    const firebaseState = await ensureFirebaseLoaded();
    const firebaseEnabled = firebaseState.enabled === true;

  
    if (!firebaseEnabled) {
        setHeaderAuthUI(null);
        if (firebaseState.reason === 'missing-config') {
            console.warn(
                'DrinkHub: Not configured Firebase. Please fill config in js/firebase-config.js and run with localhost (Live Server).'
            );
        }
    }

    if (firebaseEnabled) {
        firebase.auth().onAuthStateChanged(async user => {
            setHeaderAuthUI(user);

            const currentPath = window.location.pathname.replace(/\\/g, '/');
            if (currentPath.endsWith('/html/userPage.html')) {
                if (!user) {
                    const modalEl = document.getElementById('authModal');
                    if (modalEl && window.bootstrap?.Modal) {
                        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                        modal.show();
                    } else {
                        alert('Please log in to view the user page.');
                    }
                } else {
                    await populateUserPage(user);
                }
            }
        });
    }

    if (forgotPasswordLink && !forgotPasswordLink.dataset.bound) {
        forgotPasswordLink.dataset.bound = 'true';
        forgotPasswordLink.addEventListener('click', async event => {
            event.preventDefault();

            if (!firebaseEnabled) {
                alert('Not configured Firebase to use forgot password.');
                return;
            }

            const emailFromInput = (document.getElementById('loginEmail')?.value || '').trim();
            const email = (prompt('Enter email to reset password:', emailFromInput) || '').trim();
            if (!email) {
                return;
            }

            try {
                await firebase.auth().sendPasswordResetEmail(email);
                alert('Email sent to reset password. Please check your inbox.');
            } catch (err) {
                alert(mapFirebaseAuthError(err));
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async event => {
            event.preventDefault();

            const email = (document.getElementById('loginEmail')?.value || '').trim();
            const password = document.getElementById('loginPassword')?.value || '';
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn && submitBtn.disabled) {
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
            const errors = [];
            if (!emailRegex.test(email)) {
                errors.push('Invalid email.');
            }
            if (!password) {
                errors.push('Please enter a password.');
            }

            if (errors.length) {
                alert(errors.join('\n'));
                return;
            }

            if (!firebaseEnabled) {
                if (firebaseState.reason === 'missing-config') {
                    alert('You haven\'t configured Firebase. Please fill config in js/firebase-config.js (see FIREBASE_SETUP.md).');
                    return;
                }

                alert('Login (demo) successful.');
                return;
            }

            try {
                if (submitBtn) submitBtn.disabled = true;
                await firebase.auth().signInWithEmailAndPassword(email, password);
                const modalEl = document.getElementById('authModal');
                if (modalEl && window.bootstrap?.Modal) {
                    bootstrap.Modal.getOrCreateInstance(modalEl).hide();
                }
                loginForm.reset();
            } catch (err) {
                alert(mapFirebaseAuthError(err));
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async event => {
            event.preventDefault();

            const fullName = (document.getElementById('registerFullName')?.value || '').trim();
            const phone = (document.getElementById('registerPhone')?.value || '').trim();
            const gender = (document.getElementById('registerGender')?.value || '').trim();
            const email = (document.getElementById('registerEmail')?.value || '').trim();
            const password = document.getElementById('registerPassword')?.value || '';
            const confirmPassword = document.getElementById('registerConfirmPassword')?.value || '';
            const address = (document.getElementById('registerAddress')?.value || '').trim();
            const dob = (document.getElementById('registerDob')?.value || '').trim();

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            if (submitBtn && submitBtn.disabled) {
                return;
            }

            // Validate 
            const fullNameRegex = /^(?=.{4,30}$)(?:\p{Lu}\p{Ll}+)(?:\s+\p{Lu}\p{Ll}+)*$/u;
            const phoneRegex = /^(?:08|09|03|07|05)\d{8}$/;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
            const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

            const errors = [];

            if (!fullNameRegex.test(fullName)) {
                errors.push('Full name must be 4-30 characters, each word capitalized.');
            }
            if (!phoneRegex.test(phone)) {
                errors.push('Phone must be exactly 10 digits and start with 08, 09, 03, 07 or 05.');
            }
            if (!gender) {
                errors.push('Please select gender.');
            }
            if (!emailRegex.test(email)) {
                errors.push('Invalid email.');
            }
            if (!passwordRegex.test(password)) {
                errors.push('Password must be at least 6 characters, including 1 uppercase, 1 number, and 1 special character.');
            }
            if (password !== confirmPassword) {
                errors.push('Passwords do not match.');
            }
            if (!address) {
                errors.push('Please enter an address.');
            }
            if (!dob) {
                errors.push('Please select a date of birth.');
            } else {
                const dobDate = new Date(dob + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (!(dobDate < today)) {
                    errors.push('Date of birth must be before today.');
                }
            }

            if (errors.length) {
                alert(errors.join('\n'));
                return;
            }

            if (!firebaseEnabled) {
                if (firebaseState.reason === 'missing-config') {
                    alert('You haven\'t configured Firebase. Please fill config in js/firebase-config.js (see FIREBASE_SETUP.md).');
                    return;
                }

                alert('Registration successful.');
                return;
            }

            try {
                if (submitBtn) submitBtn.disabled = true;
                const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
                const user = cred.user;
                if (user) {
                    await user.updateProfile({ displayName: fullName });
                    await firebase.firestore().collection('users').doc(user.uid).set(
                        {
                            fullName,
                            phone,
                            gender,
                            email,
                            address,
                            dob,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        },
                        { merge: true }
                    );
                }

                const modalEl = document.getElementById('authModal');
                if (modalEl && window.bootstrap?.Modal) {
                    bootstrap.Modal.getOrCreateInstance(modalEl).hide();
                }
                registerForm.reset();
                alert('Registration successful.');
            } catch (err) {
                alert(mapFirebaseAuthError(err));
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
}

function debounce(callback, waitMs) {
    let timeoutId;
    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => callback(...args), waitMs);
    };
}

function attachCafeSearch() {
    const headerSearchInput = document.querySelector('.main-header .search-bar input');
    if (!headerSearchInput) {
        return;
    }

    const rootPath = getRootPath();
    const listPageUrl = rootPath + '/html/listPage.html';

    const listSearchInput = document.getElementById('searchInput');
    const listDistrictSelect = document.getElementById('locQuan');

    const runListFilter = () => {
        if (typeof window.locQuan === 'function') {
            window.locQuan();
        }
    };

    const applyKeywordToListPage = keyword => {
        if (!listSearchInput) {
            return;
        }
        listSearchInput.value = keyword;
        runListFilter();
    };

    if (listSearchInput) {
        const params = new URLSearchParams(window.location.search);
        const q = (params.get('q') || '').trim();
        if (q) {
            headerSearchInput.value = q;
            applyKeywordToListPage(q);
        }
    }

    headerSearchInput.addEventListener('keydown', event => {
        if (event.key !== 'Enter') {
            return;
        }
        event.preventDefault();

        const keyword = headerSearchInput.value.trim();
        if (listSearchInput) {
            applyKeywordToListPage(keyword);
            return;
        }

        const targetUrl = keyword ? `${listPageUrl}?q=${encodeURIComponent(keyword)}` : listPageUrl;
        window.location.href = targetUrl;
    });

    if (listSearchInput) {
        headerSearchInput.addEventListener(
            'input',
            debounce(() => {
                applyKeywordToListPage(headerSearchInput.value.trim());
            }, 150)
        );

        listSearchInput.addEventListener(
            'input',
            debounce(() => {
                headerSearchInput.value = listSearchInput.value;
                runListFilter();
            }, 150)
        );

        if (listDistrictSelect) {
            listDistrictSelect.addEventListener('change', () => runListFilter());
        }
    }
}

function updateMediaLinks() {
    const rootPath = getRootPath();
    const mediaEls = document.querySelectorAll('[data-src]');
    mediaEls.forEach(el => {
        const dataSrc = el.getAttribute('data-src');
        if (!dataSrc) return;

        const resolved = rootPath + '/' + dataSrc.replace(/^\//, '');
        el.setAttribute('src', resolved);
        el.removeAttribute('data-src');
    });
}
//Dùng localStorage để lưu giỏ hàng đơn giản
function loadCart() {
    try {
        const cart = JSON.parse(localStorage.getItem('drinkhub_cart') || '[]');
        return Array.isArray(cart) ? cart : [];
    } catch {
        return [];
    }
}

function getCartCount() {
    const cart = loadCart();
    return cart.reduce((sum, item) => sum + (Number(item?.qty) || 0), 0);
}

function updateCartBadge() {
    const badge = document.querySelector('.cart-btn .badge');
    if (!badge) {
        return;
    }

    const count = getCartCount();
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

window.DrinkHub = window.DrinkHub || {};
window.DrinkHub.updateCartBadge = updateCartBadge;

//Tải header và footer
async function loadComponent(id, file) {
    const element = document.getElementById(id);
    if (element) {
        try {
            const response = await fetch(file);
            if (response.ok) {
                element.innerHTML = await response.text();
            }
        } catch (err) {
            console.error("Error loading component:", err);
        }
    }
}


document.addEventListener("DOMContentLoaded", async () => {
    const basePath = getBasePath();
    await loadComponent("header-placeholder", basePath + "/html/header.html");
    await loadComponent("footer-placeholder", basePath + "/html/footer.html");
    updateNavLinks();
    updateActiveHeaderLink();
    updateMediaLinks();
    updateCartBadge();
    attachCafeCardNavigation();
    initDetailPageData();
    await attachAuthModalValidation();
    attachCafeSearch();
});