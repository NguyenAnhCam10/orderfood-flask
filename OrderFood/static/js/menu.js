function formatVnd(value) {
    const amount = Math.round(Number(value) || 0);
    return amount.toLocaleString('vi-VN') + 'đ';
}

const STATUS_LABEL = {
    AVAILABLE: 'Có sẵn',
    OUT_OF_STOCK: 'Hết hàng',
    UNAVAILABLE: 'Tạm ẩn'
};

function buildStatusSelect(dishId, currentStatus) {
    return `<select class="form-select form-select-sm dish-status-select" data-dish-id="${dishId}" style="width:auto;display:inline-block;">
        <option value="AVAILABLE" ${currentStatus === 'AVAILABLE' ? 'selected' : ''}>Có sẵn</option>
        <option value="OUT_OF_STOCK" ${currentStatus === 'OUT_OF_STOCK' ? 'selected' : ''}>Hết hàng</option>
        <option value="UNAVAILABLE" ${currentStatus === 'UNAVAILABLE' ? 'selected' : ''}>Tạm ẩn</option>
    </select>`;
}

async function addDish() {
    const addDishForm = document.getElementById('addDishForm');

    addDishForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const formData = new FormData(addDishForm);
        let imageFile = document.getElementById('dishImage').files[0];
        let imageUrl = null;

        if (imageFile) {
            const cloudData = new FormData();
            cloudData.append('file', imageFile);
            cloudData.append('upload_preset', 'ml_default');

            try {
                const cloudRes = await fetch('https://api.cloudinary.com/v1_1/dlwjqml4p/image/upload', {
                    method: 'POST',
                    body: cloudData
                });
                const cloudJson = await cloudRes.json();
                imageUrl = cloudJson.secure_url;
            } catch (err) {
                console.error("Lỗi upload Cloudinary:", err);
                alert("Không thể upload ảnh");
                return;
            }
        }
        formData.append('image_url', imageUrl);

        try {
            const res = await fetch('/owner/add_dish', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                alert('Thêm món thành công');
                const addDishContainer = document.getElementById('addDishContainer');
                const collapse = bootstrap.Collapse.getInstance(addDishContainer);
                if (collapse) {
                    collapse.hide();
                }

                addDishForm.reset();

                const dish = data.dish;
                if (dishesTableBody) {
                    const newRow = document.createElement('tr');
                    newRow.classList.add('dish-row');
                    newRow.dataset.id = dish.dish_id;
                    newRow.dataset.name = dish.name;
                    newRow.dataset.note = dish.note;
                    newRow.dataset.price = dish.price;
                    newRow.dataset.category = dish.category;
                    newRow.dataset.image = dish.image;
                    newRow.dataset.status = dish.status || 'AVAILABLE';

                    newRow.innerHTML = `
                        <td class="text-center">${dish.name}</td>
                        <td class="text-center text-truncate" style="max-width:150px;">${dish.note || "Chưa có mô tả"}</td>
                        <td class="text-center">${formatVnd(dish.price)}</td>
                        <td class="text-center">${dish.category || '-'}</td>
                        <td class="text-center">${buildStatusSelect(dish.dish_id, dish.status || 'AVAILABLE')}</td>
                        <td class="text-center">
                            <button type="button" class="btn btn-danger btn-sm middle">Xóa</button>
                        </td>
                    `;
                    dishesTableBody.appendChild(newRow);
                    attachRowClickListener(newRow);
                }

                if (dish.category) {
                    const exists = Array.from(categorySelect.options)
                                        .some(opt => opt.value === dish.category);
                    if (!exists) {
                        const newOpt = document.createElement('option');
                        newOpt.value = dish.category;
                        newOpt.textContent = dish.category;
                        const newOption = categorySelect.querySelector('option[value="new"]');
                        categorySelect.insertBefore(newOpt, newOption);
                    }
                }

                newCategoryInput.classList.add('d-none');
                newCategoryInput.required = false;
                newCategoryInput.value = "";
                categorySelect.value = dish.category || "";

            } else {
                alert(data.error || 'Thêm món thất bại');
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi server');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    addDish();
});


let currentRowId = null;

function attachRowClickListener(row) {
    row.addEventListener('click', (e) => {
        // không mở edit form khi click vào select hoặc nút xóa
        if (e.target.closest('.dish-status-select') || e.target.classList.contains('btn-danger')) return;

        const id = row.dataset.id;
        const name = row.dataset.name;
        const note = row.dataset.note;
        const price = row.dataset.price;
        const category = row.dataset.category;
        const image = row.dataset.image;
        const status = row.dataset.status || 'AVAILABLE';

        const editFormEl = document.getElementById('editDishForm');
        const collapse = bootstrap.Collapse.getOrCreateInstance(editFormEl);

        if (currentRowId === id && editFormEl.classList.contains('show')) {
            collapse.hide();
            currentRowId = null;
            return;
        }

        document.getElementById('editDishId').value = id;
        document.getElementById('editName').value = name;
        document.getElementById('editNote').value = note;
        document.getElementById('editPrice').value = price;
        document.getElementById('editCategory').value = category;
        document.getElementById('editImagePreview').src = image || '';
        document.getElementById('editStatus').value = status;

        collapse.show();
        currentRowId = id;
    });
}

document.querySelectorAll('.dish-row').forEach(row => {
    attachRowClickListener(row);
});


const categorySelect = document.getElementById('categorySelect');
const newCategoryInput = document.getElementById('newCategoryInput');

categorySelect.addEventListener('change', () => {
    if(categorySelect.value === "new"){
        newCategoryInput.classList.remove('d-none');
        newCategoryInput.required = true;
    } else {
        newCategoryInput.classList.add('d-none');
        newCategoryInput.required = false;
    }
});


const editDishForm = document.querySelector('#editDishForm form');

editDishForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(editDishForm);
    const dishId = document.getElementById('editDishId').value;

    let imageFile = document.getElementById('editImage').files[0];
    if (imageFile) {
        const cloudData = new FormData();
        cloudData.append('file', imageFile);
        cloudData.append('upload_preset', 'ml_default');

        try {
            const cloudRes = await fetch('https://api.cloudinary.com/v1_1/dlwjqml4p/image/upload', {
                method: 'POST',
                body: cloudData
            });
            const cloudJson = await cloudRes.json();
            formData.append('image_url', cloudJson.secure_url);
        } catch (err) {
            console.error("Lỗi upload Cloudinary:", err);
            alert("Không thể upload ảnh");
            return;
        }
    }

    try {
        const res = await fetch(`/owner/menu/${dishId}`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (data.success) {
            alert("Cập nhật thành công");

            const dish = data.dish;
            const row = document.querySelector(`.dish-row[data-id="${dish.dish_id}"]`);
            if (row) {
                row.dataset.name = dish.name;
                row.dataset.note = dish.note;
                row.dataset.price = dish.price;
                row.dataset.category = dish.category;
                row.dataset.image = dish.image;
                row.dataset.status = dish.status;

                row.innerHTML = `
                    <td class="text-center">${dish.name}</td>
                    <td class="text-center text-truncate" style="max-width:150px;">${dish.note || "Chưa có mô tả"}</td>
                    <td class="text-center">${formatVnd(dish.price)}</td>
                    <td class="text-center">${dish.category || '-'}</td>
                    <td class="text-center">${buildStatusSelect(dish.dish_id, dish.status)}</td>
                    <td class="text-center">
                        <button type="button" class="btn btn-danger btn-sm middle">Xóa</button>
                    </td>
                `;
            }

            const collapse = bootstrap.Collapse.getInstance(document.getElementById('editDishForm'));
            collapse.hide();

        } else {
            alert(data.error || "Cập nhật thất bại");
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi server");
    }
});


// Xóa món
const dishesTableBody = document.getElementById('dishesTableBody');

dishesTableBody.addEventListener('click', async function(e) {
    if (e.target.classList.contains('btn-danger')) {
        e.stopPropagation();

        if (!confirm("Bạn có chắc chắn muốn xoá món ăn này?")) return;

        const row = e.target.closest('.dish-row');
        const dishId = row.dataset.id;

        try {
            const res = await fetch(`/owner/menu/${dishId}`, {
                method: "DELETE"
            });
            const data = await res.json();

            if (data.success) {
                alert(data.message || "Xoá thành công");
                row.remove();

                const editFormEl = document.getElementById("editDishForm");
                const collapse = bootstrap.Collapse.getInstance(editFormEl);
                if (collapse) collapse.hide();

                if (document.querySelectorAll(".dish-row").length === 0) {
                    document.getElementById("noDishesMsg").style.display = "block";
                }
            } else {
                alert(data.error || "Xoá thất bại");
            }
        } catch (err) {
            console.error("Lỗi xoá món ăn:", err);
            alert("Lỗi server khi xoá món ăn");
        }
    }
});


// Toggle status nhanh từ dropdown trong bảng
dishesTableBody.addEventListener('change', async function(e) {
    if (!e.target.classList.contains('dish-status-select')) return;
    e.stopPropagation();

    const dishId = e.target.dataset.dishId;
    const newStatus = e.target.value;
    const row = e.target.closest('.dish-row');

    try {
        const res = await fetch(`/owner/menu/${dishId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.success) {
            row.dataset.status = data.status;
        } else {
            alert(data.error || "Cập nhật thất bại");
            // revert
            e.target.value = row.dataset.status;
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi server");
        e.target.value = row.dataset.status;
    }
});
