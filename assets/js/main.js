/*
    main.js: tải header/footer + gắn các hành vi dùng chung (search, badge giỏ hàng, validate form...).
    Mục tiêu: trang nào nhúng main.js đều chạy được dù đang ở thư mục con nào.
*/

// Tìm đường dẫn tới thư mục /assets dựa trên vị trí file main.js
function getBasePath() {
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
        if (script.src.includes('main.js')) {
            const scriptPath = script.src;
            const jsIndex = scriptPath.lastIndexOf('/js/main.js');
            if (jsIndex !== -1) {
                return scriptPath.substring(0, jsIndex);
            }
        }
    }
    return './assets';
}


function getRootPath() {
    const basePath = getBasePath();
    const assetsIndex = basePath.lastIndexOf('/assets');
    if (assetsIndex !== -1) {
        return basePath.substring(0, assetsIndex);
    }
    return '.';
}

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
            existing.addEventListener('error', () => reject(new Error('Không tải được script: ' + src)), { once: true });
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
        script.addEventListener('error', () => reject(new Error('Không tải được script: ' + src)), { once: true });
        document.head.appendChild(script);
    });
}

async function loadOptionalScript(src) {
    try {
        // Kiểm tra tồn tại trước khi load để tránh báo lỗi console 404.
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
    // Firebase Auth không chạy ổn định trên file:// (đặc biệt popup/redirect).
    // Dự án hiện có fetch component => nên chạy bằng Live Server/localhost.
    const basePath = getBasePath();
    await loadOptionalScript(basePath + '/js/firebase-config.js');

    const cfg = getFirebaseConfig();
    if (!cfg) {
        return { enabled: false, reason: 'missing-config' };
    }

    // Load Firebase compat SDK để dùng được với main.js dạng script thường.
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

function mapFirebaseAuthError(error) {
    const code = String(error?.code || '');
    switch (code) {
        case 'auth/configuration-not-found':
            return 'Firebase Authentication chưa được cấu hình đúng. Hãy vào Firebase Console → Authentication → Get started và bật phương thức Email/Password.';
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Email hoặc mật khẩu không đúng.';
        case 'auth/operation-not-allowed':
            return 'Phương thức đăng nhập này chưa được bật. Hãy bật Email/Password trong Firebase Console → Authentication → Sign-in method.';
        case 'auth/invalid-email':
            return 'Email không hợp lệ.';
        case 'auth/email-already-in-use':
            return 'Email này đã được sử dụng. Vui lòng đăng nhập.';
        case 'auth/weak-password':
            return 'Mật khẩu quá yếu.';
        case 'auth/network-request-failed':
            return 'Lỗi mạng. Vui lòng thử lại.';
        default:
            return error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
    }
}

function getUserDisplayName(user) {
    return (user?.displayName || '').trim() || (user?.email || '').trim() || 'Tài khoản';
}

function setHeaderAuthUI(user) {
    const accountButton = document.querySelector('.main-header .user-account');
    const nameSpan = document.querySelector('.main-header .user-account .user-name');
    if (!accountButton || !nameSpan) {
        return;
    }

    const rootPath = getRootPath();
    const userPageUrl = rootPath + '/assets/page/userPage/userPage.html';

    // Xoá handler cũ (nếu có)
    if (accountButton._drinkhubClickHandler) {
        accountButton.removeEventListener('click', accountButton._drinkhubClickHandler);
        accountButton._drinkhubClickHandler = null;
    }

    if (!user) {
        nameSpan.textContent = 'Đăng nhập';
        accountButton.setAttribute('data-bs-toggle', 'modal');
        accountButton.setAttribute('data-bs-target', '#authModal');
        accountButton.setAttribute('aria-label', 'Đăng nhập');
        return;
    }

    nameSpan.textContent = getUserDisplayName(user);
    accountButton.removeAttribute('data-bs-toggle');
    accountButton.removeAttribute('data-bs-target');
    accountButton.setAttribute('aria-label', 'Tài khoản');

    const handler = event => {
        // Tránh trường hợp click vào nút vẫn mở modal nếu bootstrap bắt sự kiện từ trước.
        event.preventDefault();
        window.location.href = userPageUrl;
    };
    accountButton._drinkhubClickHandler = handler;
    accountButton.addEventListener('click', handler);
}

async function populateUserPage(user) {
    // Chỉ chạy trên userPage
    const currentPath = window.location.pathname.replace(/\\/g, '/');
    if (!currentPath.endsWith('/assets/page/userPage/userPage.html')) {
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

    // Firestore profile (nếu có)
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
        console.warn('Không đọc được hồ sơ từ Firestore:', err);
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
                errors.push('Vui lòng nhập họ và tên.');
            }
            if (phone && !/^(?:08|09|03|07|05)\d{8}$/.test(phone)) {
                errors.push('Số điện thoại không hợp lệ.');
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
                alert('Cập nhật thông tin thành công.');
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

// Sau khi load component, đổi data-href -> href thật
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
    const delivery = deliveryElement ? deliveryElement.textContent.trim() : 'Giao nhanh';

    const params = new URLSearchParams({
        name,
        rating,
        reviews,
        delivery
    });

    return rootPath + '/assets/page/detailPage/detailPage.html?' + params.toString();
}

function attachCafeCardNavigation() {
    const cards = document.querySelectorAll('.cafe-card');
    if (!cards.length) {
        return;
    }

    cards.forEach(card => {
        // Card nào đã có onclick riêng (index/listPage) thì không ghi đè.
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
    const delivery = params.get('delivery') || 'Giao nhanh';

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
        titleElement.textContent = 'Chi tiet quan - ' + name;
    }
}

async function attachAuthModalValidation() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    const firebaseState = await ensureFirebaseLoaded();
    const firebaseEnabled = firebaseState.enabled === true;

    // Nếu chưa bật Firebase, vẫn set UI về trạng thái chưa đăng nhập.
    if (!firebaseEnabled) {
        setHeaderAuthUI(null);
        if (firebaseState.reason === 'missing-config') {
            console.warn(
                'DrinkHub: Chưa cấu hình Firebase. Hãy điền config ở assets/js/firebase-config.js và chạy bằng localhost (Live Server).'
            );
        }
    }

    if (firebaseEnabled) {
        // Đồng bộ UI header theo trạng thái đăng nhập
        firebase.auth().onAuthStateChanged(async user => {
            setHeaderAuthUI(user);

            const currentPath = window.location.pathname.replace(/\\/g, '/');
            if (currentPath.endsWith('/assets/page/userPage/userPage.html')) {
                if (!user) {
                    // Mở modal đăng nhập khi truy cập userPage mà chưa đăng nhập.
                    const modalEl = document.getElementById('authModal');
                    if (modalEl && window.bootstrap?.Modal) {
                        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                        modal.show();
                    } else {
                        alert('Vui lòng đăng nhập để xem trang tài khoản.');
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
                alert('Chưa cấu hình Firebase để dùng chức năng quên mật khẩu.');
                return;
            }

            const emailFromInput = (document.getElementById('loginEmail')?.value || '').trim();
            const email = (prompt('Nhập email để đặt lại mật khẩu:', emailFromInput) || '').trim();
            if (!email) {
                return;
            }

            try {
                await firebase.auth().sendPasswordResetEmail(email);
                alert('Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.');
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
                errors.push('Email không hợp lệ.');
            }
            if (!password) {
                errors.push('Vui lòng nhập mật khẩu.');
            }

            if (errors.length) {
                alert(errors.join('\n'));
                return;
            }

            if (!firebaseEnabled) {
                if (firebaseState.reason === 'missing-config') {
                    alert('Bạn chưa cấu hình Firebase. Hãy điền config ở assets/js/firebase-config.js (xem FIREBASE_SETUP.md).');
                    return;
                }

                alert('Đăng nhập (demo) thành công.');
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

            // Validate bằng regex (đăng ký)
            const fullNameRegex = /^(?=.{4,30}$)(?:\p{Lu}\p{Ll}+)(?:\s+\p{Lu}\p{Ll}+)*$/u;
            const phoneRegex = /^(?:08|09|03|07|05)\d{8}$/;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
            const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

            const errors = [];

            if (!fullNameRegex.test(fullName)) {
                errors.push('Họ tên phải có từ 4 đến 30 ký tự, mỗi chữ cái đầu viết hoa.');
            }
            if (!phoneRegex.test(phone)) {
                errors.push('Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng 08, 09, 03, 07 hoặc 05.');
            }
            if (!gender) {
                errors.push('Vui lòng chọn giới tính.');
            }
            if (!emailRegex.test(email)) {
                errors.push('Email không hợp lệ.');
            }
            if (!passwordRegex.test(password)) {
                errors.push('Mật khẩu phải có ít nhất 6 ký tự, bao gồm 1 chữ hoa, 1 số và 1 ký tự đặc biệt.');
            }
            if (password !== confirmPassword) {
                errors.push('Mật khẩu nhập lại không khớp.');
            }
            if (!address) {
                errors.push('Vui lòng nhập địa chỉ.');
            }
            if (!dob) {
                errors.push('Vui lòng chọn ngày sinh.');
            } else {
                const dobDate = new Date(dob + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (!(dobDate < today)) {
                    errors.push('Ngày sinh phải trước ngày hôm nay.');
                }
            }

            if (errors.length) {
                alert(errors.join('\n'));
                return;
            }

            if (!firebaseEnabled) {
                if (firebaseState.reason === 'missing-config') {
                    alert('Bạn chưa cấu hình Firebase. Hãy điền config ở assets/js/firebase-config.js (xem FIREBASE_SETUP.md).');
                    return;
                }

                alert('Đăng ký thành công.');
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
                alert('Đăng ký thành công.');
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
    const listPageUrl = rootPath + '/assets/page/listPage/listPage.html';

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

    // Nếu đang ở listPage và có ?q=... thì tự đổ vào ô tìm kiếm và lọc luôn
    if (listSearchInput) {
        const params = new URLSearchParams(window.location.search);
        const q = (params.get('q') || '').trim();
        if (q) {
            headerSearchInput.value = q;
            applyKeywordToListPage(q);
        }
    }

    // Nhấn Enter ở ô search header: đang ở listPage thì lọc, không thì chuyển trang sang listPage
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

    // Ở listPage: gõ ở header sẽ lọc realtime
    if (listSearchInput) {
        headerSearchInput.addEventListener(
            'input',
            debounce(() => {
                applyKeywordToListPage(headerSearchInput.value.trim());
            }, 150)
        );

        // Gõ ở ô search của listPage cũng sync ngược lại lên header
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

// Giỏ hàng: lưu trong localStorage key "drinkhub_cart"
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

// Public API nhỏ để trang khác gọi cập nhật badge
window.DrinkHub = window.DrinkHub || {};
window.DrinkHub.updateCartBadge = updateCartBadge;

// Load HTML component vào placeholder
async function loadComponent(id, file) {
    const element = document.getElementById(id);
    if (element) {
        try {
            const response = await fetch(file);
            if (response.ok) {
                element.innerHTML = await response.text();
            }
        } catch (err) {
            console.error("Lỗi tải component:", err);
        }
    }
}

// Khởi tạo sau khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", async () => {
    const basePath = getBasePath();
    await loadComponent("header-placeholder", basePath + "/component/header/header.html");
    await loadComponent("footer-placeholder", basePath + "/component/footer/footer.html");
    updateNavLinks();
    updateActiveHeaderLink();
    updateCartBadge();
    attachCafeCardNavigation();
    initDetailPageData();
    await attachAuthModalValidation();
    attachCafeSearch();
});