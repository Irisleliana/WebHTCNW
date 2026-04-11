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

function attachAuthModalValidation() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', event => {
            event.preventDefault();

            const email = (document.getElementById('loginEmail')?.value || '').trim();
            const password = document.getElementById('loginPassword')?.value || '';

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

            alert('Đăng nhập (demo) thành công.');
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', event => {
            event.preventDefault();

            const fullName = (document.getElementById('registerFullName')?.value || '').trim();
            const phone = (document.getElementById('registerPhone')?.value || '').trim();
            const gender = (document.getElementById('registerGender')?.value || '').trim();
            const email = (document.getElementById('registerEmail')?.value || '').trim();
            const password = document.getElementById('registerPassword')?.value || '';
            const confirmPassword = document.getElementById('registerConfirmPassword')?.value || '';
            const address = (document.getElementById('registerAddress')?.value || '').trim();
            const dob = (document.getElementById('registerDob')?.value || '').trim();

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

            alert('Đăng ký thành công.');
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
    attachAuthModalValidation();
    attachCafeSearch();
});