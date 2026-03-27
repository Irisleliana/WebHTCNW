// Hàm load HTML từ file component
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

// Chạy khi web load xong
document.addEventListener("DOMContentLoaded", () => {
    loadComponent("header-placeholder", "./assets/component/header.html");
    loadComponent("footer-placeholder", "./assets/component/footer.html");
});