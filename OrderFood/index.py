# index.py
import os, traceback
from flask import render_template, request, redirect, url_for, flash, session, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
# from OrderFood import app, db
from flask import Blueprint
# from OrderFood import db
from OrderFood.extensions import db
from OrderFood.customer_service import PHONE_RE, get_user_by_phone
from OrderFood.dao import *
from OrderFood.dao_index import get_restaurants_by_name, get_restaurants_by_dishes_name, get_star_display, \
    get_user_by_email, create_user, get_active_cart, add_cart_item, count_cart_items
from OrderFood.models import Restaurant, Customer, Cart, StatusCart, Role, Category, Dish, RestaurantCategory
from sqlalchemy import or_
bp = Blueprint("index", __name__)
# --- Helpers ---
ENUM_UPPERCASE = True
def norm_role_for_db(role: str) -> str:
    role = (role or "customer").strip().lower()
    if ENUM_UPPERCASE:
        return "CUSTOMER" if role == "customer" else "RESTAURANT_OWNER"
    return role

def _role_to_str(r):
    return getattr(r, "value", r)

def is_owner(role: str) -> bool:
    rolestr = _role_to_str(role)
    return (rolestr or "").lower() == "restaurant_owner"

CATEGORY_GROUPS = [
    ("com", "Cơm", ["com", "rice", "don", "gyudon", "curry"]),
    ("bun-pho", "Bún phở", ["bun", "pho", "phở", "hủ tiếu", "hu tieu", "noodle soup"]),
    ("an-nhanh", "Ăn nhanh", ["combo", "set", "burger", "ga ran", "gà rán", "fast", "snack", "alacarte"]),
    ("mi", "Mì", ["mi", "mì", "ramen", "udon", "soba", "noodle"]),
    ("sashimi", "Sashimi", ["sashimi", "sushi", "ca ngu", "cá ngừ"]),
    ("salad", "Salad", ["salad", "rau", "vegetable", "healthy"]),
    ("banh-mi", "Bánh mì", ["banh mi", "bánh mì", "bread", "sandwich", "banh", "bánh"]),
    ("nuoc", "Nước", ["nuoc", "nước", "drink", "tra", "trà", "soda", "juice", "sukicha"]),
]


def _normalize_text(value: str) -> str:
    replacements = {
        "á": "a", "à": "a", "ả": "a", "ã": "a", "ạ": "a", "ă": "a", "ắ": "a", "ằ": "a", "ẳ": "a", "ẵ": "a", "ặ": "a",
        "â": "a", "ấ": "a", "ầ": "a", "ẩ": "a", "ẫ": "a", "ậ": "a", "đ": "d", "é": "e", "è": "e", "ẻ": "e", "ẽ": "e",
        "ẹ": "e", "ê": "e", "ế": "e", "ề": "e", "ể": "e", "ễ": "e", "ệ": "e", "í": "i", "ì": "i", "ỉ": "i", "ĩ": "i",
        "ị": "i", "ó": "o", "ò": "o", "ỏ": "o", "õ": "o", "ọ": "o", "ô": "o", "ố": "o", "ồ": "o", "ổ": "o", "ỗ": "o",
        "ộ": "o", "ơ": "o", "ớ": "o", "ờ": "o", "ở": "o", "ỡ": "o", "ợ": "o", "ú": "u", "ù": "u", "ủ": "u", "ũ": "u",
        "ụ": "u", "ư": "u", "ứ": "u", "ừ": "u", "ử": "u", "ữ": "u", "ự": "u", "ý": "y", "ỳ": "y", "ỷ": "y", "ỹ": "y",
        "ỵ": "y",
    }
    text = (value or "").lower()
    return "".join(replacements.get(ch, ch) for ch in text)


def _category_group_key(category_name: str, dish_names=None):
    haystack = _normalize_text(" ".join([category_name or "", *(dish_names or [])]))
    for key, _label, keywords in CATEGORY_GROUPS:
        if any(_normalize_text(keyword) in haystack for keyword in keywords):
            return key
    return None

# --- Routes ---
@bp.route("/")
def index():
    role = session.get("role")
    if role and role.lower() == "admin":
        flash("Admin không được truy cập trang này.", "warning")
        return redirect(url_for("admin.admin_home"))
    keyword = (request.args.get("search") or "").strip()
    rating_filter = request.args.get("rating")
    restaurant_category_filter = (request.args.get("restaurant_category") or "").strip()
    category_group_filter = (request.args.get("category_group") or "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = 12

    restaurant_query = Restaurant.query

    if keyword:
        like_keyword = f"%{keyword}%"
        dish_restaurant_ids = [
            row[0] for row in Dish.query
            .filter(Dish.name.ilike(like_keyword))
            .with_entities(Dish.res_id)
            .distinct()
            .all()
        ]
        restaurant_query = restaurant_query.filter(
            or_(
                Restaurant.name.ilike(like_keyword),
                Restaurant.address.ilike(like_keyword),
                Restaurant.restaurant_id.in_(dish_restaurant_ids or [-1]),
            )
        )

    if restaurant_category_filter:
        restaurant_query = restaurant_query.join(RestaurantCategory).filter(
            RestaurantCategory.name == restaurant_category_filter
        )

    if rating_filter and rating_filter.isdigit():
        restaurant_query = restaurant_query.filter(Restaurant.rating_point >= int(rating_filter))

    grouped_category_ids = []
    category_options = (
        Category.query
        .join(Restaurant, Category.res_id == Restaurant.restaurant_id)
        .order_by(Restaurant.name.asc(), Category.name.asc())
        .all()
    )
    grouped_categories = {key: {"key": key, "label": label, "count": 0} for key, label, _ in CATEGORY_GROUPS}
    for cat in category_options:
        sample_dish_names = [
            row[0] for row in Dish.query
            .filter_by(category_id=cat.category_id)
            .with_entities(Dish.name)
            .limit(8)
            .all()
        ]
        group_key = _category_group_key(cat.name, sample_dish_names)
        if group_key:
            grouped_categories[group_key]["count"] += 1
            if category_group_filter == group_key:
                grouped_category_ids.append(cat.category_id)

    if category_group_filter and not grouped_category_ids:
        grouped_category_ids = [-1]

    if category_group_filter:
        dish_query = Dish.query
        dish_query = dish_query.filter(Dish.category_id.in_(grouped_category_ids))
        matched_restaurant_ids = [
            row[0] for row in dish_query.with_entities(Dish.res_id).distinct().all()
        ]
        restaurant_query = restaurant_query.filter(
            Restaurant.restaurant_id.in_(matched_restaurant_ids or [-1])
        )

    restaurants = restaurant_query.order_by(Restaurant.rating_point.desc()).all()
    restaurant_options = Restaurant.query.order_by(Restaurant.name.asc()).all()
    category_groups = [grouped_categories[key] for key, _label, _keywords in CATEGORY_GROUPS]

    restaurant_groups = {}
    for res in restaurant_options:
        if res.restaurant_category:
            restaurant_groups.setdefault(res.restaurant_category.name, []).append(res)

    preferred_group_order = ["Viet", "Nhat"]
    ordered_restaurant_groups = {
        key: restaurant_groups.pop(key)
        for key in preferred_group_order
        if key in restaurant_groups
    }
    for key in sorted(restaurant_groups):
        ordered_restaurant_groups[key] = restaurant_groups[key]

    dish_sections = []
    for res in restaurants[:8]:
        categories = Category.query.filter_by(res_id=res.restaurant_id).order_by(Category.name.asc()).all()
        category_items = []
        for cat in categories[:4]:
            foods_query = Dish.query.filter_by(category_id=cat.category_id)
            foods = foods_query.order_by(Dish.name.asc()).limit(4).all()
            if foods:
                category_items.append({"category": cat, "dishes": foods})
        if category_items:
            dish_sections.append({"restaurant": res, "categories": category_items})
    total = len(restaurants)
    start = (page - 1) * per_page
    end = start + per_page
    restaurants_page = restaurants[start:end]
    restaurants_with_stars = [
        {"restaurant": r, "stars": get_star_display(r.rating_point or 0)}
        for r in restaurants_page
    ]

    return render_template(
        "customer_home.html",
        restaurants=restaurants_with_stars,
        restaurant_groups=ordered_restaurant_groups,
        restaurant_options=restaurant_options,
        category_groups=category_groups,
        dish_sections=dish_sections,
        page=page,
        per_page=per_page,
        total=total,
    )

@bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        form = request.form  # giữ lại để render khi lỗi
        name = (form.get("name") or "").strip()
        email = (form.get("email") or "").strip().lower()
        phone = (form.get("phone") or "").strip()
        role  = norm_role_for_db(form.get("role", "customer"))
        password = form.get("password") or ""
        confirm  = form.get("confirm_password") or ""

        # Dữ liệu giữ lại (không giữ password vì bảo mật)
        keep = {"form_data": {"name": name, "email": email, "phone": phone, "role": form.get("role")}, "panel": "signup"}

        # --- Validate bắt buộc ---
        if not name:
            flash("Tên không được để trống", "warning")
            return render_template("auth.html", **keep)
        if not email:
            flash("Email là bắt buộc", "danger")
            return render_template("auth.html", **keep)
        if not phone:
            flash("Số điện thoại là bắt buộc", "danger")
            return render_template("auth.html", **keep)
        if not PHONE_RE.match(phone):
            flash("Số điện thoại không hợp lệ. Yêu cầu 10 số và bắt đầu bằng 0.", "warning")
            return render_template("auth.html", **keep)

        # --- Check tồn tại ---
        if get_user_by_email(email):
            flash("Email đã tồn tại", "warning")
            return render_template("auth.html", **keep)
        if get_user_by_phone(phone):
            flash("Số điện thoại này đã đăng ký", "warning")
            return render_template("auth.html", **keep)

        # --- Mật khẩu: độ dài trước, rồi mới khớp ---
        if len(password) < 6:
            flash("Mật khẩu tối thiểu 6 ký tự", "warning")
            return render_template("auth.html", **keep)
        if password != confirm:
            flash("Mật khẩu xác nhận không khớp", "warning")
            return render_template("auth.html", **keep)

        # --- Tạo tài khoản ---
        hashed = generate_password_hash(password)
        create_user(name=name, email=email, phone=phone, hashed_password=hashed, role=role)

        user = get_user_by_email(email)
        session["user_id"] = user.user_id
        session["user_email"] = user.email
        session["user_name"] = user.name
        session["role"] = (getattr(user.role, "value", user.role) or "").lower()

        flash("Đăng ký thành công! Bạn đã được đăng nhập.", "success")
        return redirect(url_for("owner.owner_home") if is_owner(user.role) else url_for("index.index"))

    return render_template("auth.html", panel="signup")


@bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        user = get_user_by_email(email)
        if not user or not check_password_hash(user.password, password):
            flash("Tài khoản hoặc mật khẩu không chính xác.", "danger")
            return redirect(url_for("login"))

        session["user_id"] = user.user_id
        session["user_email"] = user.email
        session["user_name"] = user.name
        session["role"] = _role_to_str(user.role)

        if is_owner(user.role):
            return redirect(url_for("owner.owner_home"))
        elif user.role == Role.ADMIN:
            return redirect(url_for("admin.admin_home"))
        else:
            return redirect(url_for("index.index"))

    return render_template("auth.html")

@bp.route("/logout")
def logout():
    session.clear()
    flash("Đã đăng xuất", "info")
    return redirect(url_for("index.index"))

# --- Cart API ---
@bp.route('/api/cart', methods=['POST'])
def add_to_cart_route():
    try:
        data = request.get_json()
        dish_id = data.get("dish_id")
        restaurant_id = data.get("restaurant_id")
        try:
            quantity = int(data.get("quantity", 1))
            if quantity <= 0:
                quantity = 1
        except:
            quantity = 1
        note = data.get("note", "")

        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Bạn chưa đăng nhập"}), 403

        customer = Customer.query.filter_by(user_id=user_id).first()
        if not customer:
            return jsonify({"error": "Bạn không phải là khách hàng"}), 403

        cart = get_active_cart(user_id, restaurant_id)
        if not cart:
            cart = Cart(cus_id=user_id, res_id=restaurant_id, status=StatusCart.ACTIVE)
            db.session.add(cart)
            db.session.commit()

        add_cart_item(cart, dish_id, quantity, note)
        total_items = count_cart_items(cart)
        return jsonify({"total_items": total_items})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@bp.route("/cart/<int:restaurant_id>")
def cart_route(restaurant_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Bạn chưa đăng nhập"}), 403

    customer = Customer.query.filter_by(user_id=user_id).first()
    if not customer:
        return jsonify({"error": "Bạn không phải là khách hàng"}), 403

    cart = get_active_cart(user_id, restaurant_id)
    cart_items = cart.items if cart else []
    total_price = sum(item.quantity * item.dish.price for item in cart_items) if cart_items else 0

    return render_template("/customer/cart.html", cart=cart, cart_items=cart_items, total_price=total_price)
# deploy thì bỏ nguyên cái if này đi

if __name__ == "__main__":
    bp.run(host="0.0.0.0", port=5000, debug=True)
