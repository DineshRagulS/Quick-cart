document.head.insertAdjacentHTML(
    "beforeend",
    "<style>.heart.active{color:#e64545;background:#fff0f0;font-weight:700}#cart.open{transform:translateX(0)}#shade.open~aside:not(.open){transform:translateX(100%)}.coupon{display:flex;border:1px dashed #9bb4d0;border-radius:5px;overflow:hidden;margin:14px 0 5px}.coupon input{min-width:0;flex:1;border:0;padding:10px;outline:0}.coupon button{background:#eaf3ff;border:0;border-left:1px dashed #9bb4d0;padding:0 15px;color:#2674d9;font-size:12px;font-weight:700;cursor:pointer}.coupon-help{display:block;margin-bottom:13px;color:#697b8b;font-size:11px}.discount-value{color:#168352}#toast{position:fixed;z-index:30;left:50%;bottom:25px;transform:translate(-50%,20px);background:#172b40;color:#fff;padding:12px 17px;border-radius:5px;box-shadow:0 8px 25px #10203044;font-size:12px;opacity:0;pointer-events:none;transition:.25s;white-space:nowrap}#toast.show{opacity:1;transform:translate(-50%,0)}@media(max-width:540px){header{padding:0 8px;gap:6px;height:60px;flex-wrap:nowrap}.header-links{gap:4px}.header-links button{font-size:16px;padding:4px}.header-links b{width:12px;height:12px;font-size:7px}.logo{font-size:17px}.mobile-menu{padding:4px;font-size:20px}.search{left:0;right:0;flex:1;min-width:0}.topbar{padding:0 8px}.hero{padding:0 8px}.hero>div{padding-left:17px}.trust{margin-left:8px;margin-right:8px}.categories,.products{padding-left:10px;padding-right:10px}.category-grid{margin-right:-10px}.product-grid{gap:8px}.image-wrap{height:160px}.product-details h3{height:33px}.price em{display:none}.add{font-size:11px}.offer{margin-left:10px;margin-right:10px}.dialog{width:calc(100% - 18px);max-height:94vh}.dialog-head{padding:17px}.cart-item{grid-template-columns:54px 1fr auto}.cart-item img{width:54px;height:65px}#toast{max-width:calc(100% - 30px);white-space:normal;text-align:center}}</style>",
);

const cart = [];
const $ = (s) => document.querySelector(s);
const rupees = (n) => "₹" + Math.max(0, n).toLocaleString("en-IN");
let currentUser = null,
    checkoutAddress = {},
    couponDiscount = 0,
    favouriteIds = [],
    lastOrderError = "";
const subtotal = () => cart.reduce((a, x) => a + x.price * x.qty, 0),
    delivery = () => (subtotal() > 0 && subtotal() < 699 ? 50 : 0),
    total = () => Math.max(0, subtotal() - couponDiscount + delivery());
function toast(message) {
    let el = $("#toast");
    if (!el) {
        el = document.createElement("div");
        el.id = "toast";
        document.body.append(el);
    }
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2300);
}
function openLayer(el) {
    document
        .querySelectorAll("aside,.dialog")
        .forEach((x) => {
            if (x !== el) x.classList.remove("open");
        });
    $("#shade").classList.add("open");
    el.classList.add("open");
    if (el.id === "mobileMenu") {
        $("#menuBtn").classList.add("open");
    }
}
function closeLayers() {
    $("#shade").classList.remove("open");
    document
        .querySelectorAll("aside,.dialog")
        .forEach((x) => x.classList.remove("open"));
    $("#menuBtn").classList.remove("open");
}
window.showAuthGate = () => {
    if (verificationTimer) clearInterval(verificationTimer);
    pendingAuth = null;
    if ($("#verifyForm")) $("#verifyForm").style.display = "none";
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    if (users.length > 0) {
        $("#savedAccounts").style.display = "block";
        $("#authForm").style.display = "none";
        $("#authSwitch").style.display = "none";
        $("#savedAccountsList").innerHTML = users
            .map(
                (u) =>
                    `<div class="payment-option" style="margin:0;padding:10px;display:flex;align-items:center;gap:10px" onclick="loginAs('${u.email}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--navy)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> <div style="flex:1;line-height:1.4"><strong>${u.name || u.email.split("@")[0]}</strong><br><small>${u.email}</small></div></div>`,
            )
            .join("");
    } else {
        $("#savedAccounts").style.display = "none";
        $("#authForm").style.display = "block";
        $("#authSwitch").style.display = "block";
    }
    $("#authGate").classList.remove("hidden");
};
const REQUIRE_EMAIL_VERIFICATION = true; // Email OTP verification active via Resend API

window.loginAs = async (email) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find((u) => u.email === email);
    if (user) {
        if (REQUIRE_EMAIL_VERIFICATION) {
            await initiateEmailVerification({
                mode: "login",
                email: user.email,
                name: user.name || user.email.split("@")[0],
                password: user.password,
                userObj: user
            });
        } else {
            await setUser(user);
            toast("Welcome back!");
        }
    }
};
$("#useAnotherBtn").onclick = () => {
    $("#savedAccounts").style.display = "none";
    $("#authForm").style.display = "block";
    $("#authSwitch").style.display = "block";
};
async function initApp() {
    setupOtpInputs();
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("auth") === "1" || params.get("logout") === "1") {
            currentUser = null;
            localStorage.removeItem("currentUser");
            sessionStorage.removeItem("skipAuth");
            showAuthGate();
            return;
        }
        const user = JSON.parse(localStorage.getItem("currentUser"));
        if (user) await setUser(user);
        else if (!sessionStorage.getItem("skipAuth")) showAuthGate();
    } catch (e) {}
}
async function setUser(user) {
    currentUser = user;
    $("#authGate").classList.add("hidden");
    localStorage.setItem("currentUser", JSON.stringify(user));
    const name = user.name || user.email.split("@")[0];
    $("#accountBtn").innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom;margin-right:4px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> <span>${name}</span>`;
    const addresses = JSON.parse(localStorage.getItem("addresses") || "[]");
    const addr = addresses.find((a) => a.user_id === user.id);
    if (addr)
        checkoutAddress = {
            name: addr.full_name,
            phone: addr.phone,
            address: addr.address,
            city: addr.city,
            state: addr.state,
            pin: addr.pin,
        };
    await loadFavourites();
}
async function loadFavourites() {
    if (!currentUser) return;
    favouriteIds = JSON.parse(
        localStorage.getItem(`favs_${currentUser.id}`) || "[]",
    );
    renderFavourites();
}
function renderCart() {
    const n = cart.reduce((a, x) => a + x.qty, 0);
    $("#cartCount").textContent = n;
    $("#drawerCount").textContent = `(${n} ${n === 1 ? "item" : "items"})`;
    $("#subtotal").textContent = rupees(subtotal());
    $("#cartItems").innerHTML = cart.length
        ? cart
              .map(
                  (x) =>
                      `<div class="cart-item"><img src="${x.image}" alt="${x.name}"><div><h4>${x.name}</h4><p>Quantity: ${x.qty}</p><button data-remove="${x.id}">Remove</button></div><strong>${rupees(x.price * x.qty)}</strong></div>`,
              )
              .join("")
        : '<p class="cart-empty">Your cart is empty.<br>Let’s find something you’ll love.</p>';
    document.querySelectorAll(".add[data-id]").forEach((b) => {
        const id = Number(b.dataset.id);
        const item = cart.find((x) => x.id === id);
        if (item) {
            b.innerHTML = `<span class="minus" style="padding:9px 15px;font-size:18px;cursor:pointer;color:var(--blue);line-height:1;margin:-9px -10px">-</span> <span style="color:var(--navy);font-weight:700">${item.qty}</span> <span class="plus" style="padding:9px 15px;font-size:18px;cursor:pointer;color:var(--blue);line-height:1;margin:-9px -10px">+</span>`;
            b.style.padding = "9px 10px";
            b.style.background = "#eaf3ff";
            b.style.border = "1px solid var(--blue)";
            b.style.color = "var(--navy)";
        } else {
            const p = PRODUCTS.find((x) => x.id === id);
            if (p && p.stock === 0) {
                b.innerHTML = "Out of stock";
            } else {
                b.innerHTML = "Add to cart <b>+</b>";
            }
            b.style.padding = "";
            b.style.background = "";
            b.style.border = "";
            b.style.color = "";
        }
    });
}
let cartAnimTimeout = null;

function playCenterCartAnimation(sourceElement) {
    const centerCart = document.getElementById("centerCart");
    const animOverlay = document.getElementById("animOverlay");
    if (!sourceElement || !centerCart || !animOverlay) return;
    
    if (cartAnimTimeout) clearTimeout(cartAnimTimeout);
    
    animOverlay.style.display = 'flex';
    centerCart.classList.remove('shake');
    centerCart.classList.add('show');
    
    const srcRect = sourceElement.getBoundingClientRect();
    const dot = document.createElement("div");
    dot.className = "cart-anim-dot";
    
    const startX = srcRect.left + srcRect.width / 2 - 12;
    const startY = srcRect.top + srcRect.height / 2 - 12;
    dot.style.left = `${startX}px`;
    dot.style.top = `${startY}px`;
    document.body.appendChild(dot);
    
    dot.getBoundingClientRect(); // trigger reflow
    
    const endX = window.innerWidth / 2 - 12;
    const endY = window.innerHeight / 2 - 12;
    
    dot.style.transition = "left 0.7s linear, top 0.7s cubic-bezier(0.4, -0.7, 1, 1)";
    dot.style.left = `${endX}px`;
    dot.style.top = `${endY}px`;
    
    setTimeout(() => {
        dot.remove();
    }, 700);
    
    cartAnimTimeout = setTimeout(() => {
        centerCart.classList.add("shake");
        setTimeout(() => {
            centerCart.classList.remove("shake");
            centerCart.classList.remove("show");
            animOverlay.style.display = 'none';
        }, 1000);
    }, 700);
}

document.querySelectorAll(".add").forEach(
    (b) =>
        (b.onclick = (e) => {
            e.stopPropagation();
            const id = Number(b.dataset.id);
            const item = cart.find((x) => x.id === id);
            if (item) {
                if (e.target.classList.contains("minus")) {
                    item.qty--;
                    if (item.qty <= 0) cart.splice(cart.indexOf(item), 1);
                    renderCart();
                } else if (e.target.classList.contains("plus")) {
                    if (item.qty < item.stock) {
                        item.qty++;
                        renderCart();
                        playCenterCartAnimation(b);
                    } else {
                        toast("Cannot add more than available stock.");
                    }
                }
                return;
            }
            const p = PRODUCTS.find((x) => x.id == id);
            if (p.stock > 0) {
                cart.push({ ...p, qty: 1 });
                renderCart();
                toast(`${p.name} added to cart`);
                playCenterCartAnimation(b);
            } else {
                toast("Out of stock.");
            }
        }),
);
$("#cartToggle").onclick = () => openLayer($("#cart"));
$("#closeCart").onclick = closeLayers;
$("#shade").onclick = closeLayers;
window.cartAdd = (id) => {
    const item = cart.find(x => x.id === id);
    if (item) {
        if (item.qty < item.stock) {
            item.qty++;
            renderCart();
            toast("Added to cart");
        } else {
            toast("Cannot add more than available stock.");
        }
        return;
    }
    const p = PRODUCTS.find(x => x.id == id);
    if (p && p.stock > 0) {
        cart.push({ ...p, qty: 1 });
        renderCart();
        toast(`${p.name} added to cart`);
    } else {
        toast("Out of stock.");
    }
};
$("#cartItems").onclick = (e) => {
    if (e.target.dataset.remove) {
        cart.splice(
            cart.findIndex((x) => x.id == e.target.dataset.remove),
            1,
        );
        renderCart();
    }
};
function renderFavourites() {
    document.querySelectorAll(".heart").forEach((b) => {
        const id = Number(b.closest(".card").querySelector(".add").dataset.id),
            saved = favouriteIds.includes(id);
        b.classList.toggle("active", saved);
        b.textContent = saved ? "♥" : "♡";
    });
}
document.querySelectorAll(".heart").forEach(
    (b) =>
        (b.onclick = () => {
            if (!currentUser) {
                toast("Please sign in first.");
                return;
            }
            const id = Number(
                    b.closest(".card").querySelector(".add").dataset.id,
                ),
                saved = favouriteIds.includes(id);
            if (saved) {
                favouriteIds = favouriteIds.filter((x) => x !== id);
            } else {
                favouriteIds.push(id);
            }
            localStorage.setItem(
                `favs_${currentUser.id}`,
                JSON.stringify(favouriteIds),
            );
            renderFavourites();
            toast(saved ? "Removed from favourites" : "Saved to favourites");
        }),
);
renderFavourites();
function applyFilter(f) {
    document
        .querySelectorAll(".chips button")
        .forEach((b) => b.classList.toggle("active", b.dataset.filter === f));
    
    const priceFilter = document.getElementById("priceFilter") ? document.getElementById("priceFilter").value : "all";
    const sortFilter = document.getElementById("sortFilter") ? document.getElementById("sortFilter").value : "default";

    const grid = document.getElementById("productGrid");
    if (grid) {
        let cards = Array.from(grid.querySelectorAll(".card"));
        cards.sort((a, b) => {
            if (sortFilter === "priceLowHigh") {
                const pA = parseInt(a.querySelector(".price strong").innerText.replace(/[^0-9]/g, ""), 10);
                const pB = parseInt(b.querySelector(".price strong").innerText.replace(/[^0-9]/g, ""), 10);
                return pA - pB;
            } else if (sortFilter === "priceHighLow") {
                const pA = parseInt(a.querySelector(".price strong").innerText.replace(/[^0-9]/g, ""), 10);
                const pB = parseInt(b.querySelector(".price strong").innerText.replace(/[^0-9]/g, ""), 10);
                return pB - pA;
            } else if (sortFilter === "ratingHighLow") {
                const matchA = a.querySelector(".rating").innerText.match(/★\s*([0-9.]+)/);
                const matchB = b.querySelector(".rating").innerText.match(/★\s*([0-9.]+)/);
                const rA = matchA ? parseFloat(matchA[1]) : 0;
                const rB = matchB ? parseFloat(matchB[1]) : 0;
                return rB - rA;
            } else {
                const idA = parseInt(a.querySelector(".add").dataset.id, 10);
                const idB = parseInt(b.querySelector(".add").dataset.id, 10);
                return idA - idB; 
            }
        });
        cards.forEach(card => grid.appendChild(card));
    }

    let c = 0;
    document.querySelectorAll("#productGrid .card").forEach((x) => {
        const categoryMatch = f === "All" || x.dataset.category === f;
        
        let priceMatch = true;
        if (priceFilter !== "all") {
            const priceText = x.querySelector(".price strong").innerText.replace(/[^0-9]/g, "");
            const price = parseInt(priceText, 10);
            if (priceFilter === "under1000") priceMatch = price < 1000;
            else if (priceFilter === "1000to5000") priceMatch = price >= 1000 && price <= 5000;
            else if (priceFilter === "over5000") priceMatch = price > 5000;
        }

        const yes = categoryMatch && priceMatch;
        x.style.display = yes ? "block" : "none";
        if (yes) c++;
    });
    
    const emptyEl = document.getElementById("empty");
    if (emptyEl) emptyEl.style.display = c === 0 ? "block" : "none";
    $("#products").scrollIntoView({ behavior: "smooth" });
}
document
    .querySelectorAll("[data-filter]")
    .forEach((b) => (b.onclick = () => applyFilter(b.dataset.filter)));
function search(doScroll = false) {
    const terms = $("#productSearch")
        .value.toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
        
    const results = $("#searchResults");

    // If searching (Enter/Click), filter the main grid
    if (doScroll) {
        let c = 0;
        document.querySelectorAll("#productGrid .card").forEach((x) => {
            const name = x.getAttribute("data-name") || "";
            const yes = terms.every((t) => name.includes(t));
            x.style.display = yes ? "block" : "none";
            if (yes) c++;
        });
        const emptyEl = document.getElementById("empty");
        if (emptyEl) emptyEl.style.display = c === 0 ? "block" : "none";
        document
            .querySelectorAll(".chips button")
            .forEach((b) => b.classList.remove("active"));
            
        if (terms.length) $("#products").scrollIntoView({ behavior: "smooth" });
        results.classList.add("hidden");
        return;
    }

    // Auto-recommendation (Typing)
    if (!terms.length) {
        results.classList.add("hidden");
        return;
    }
    const matches = PRODUCTS.filter((p) => {
        const name = (p.name + " " + p.category).toLowerCase();
        return terms.every((t) => name.includes(t));
    }).slice(0, 6);

    if (matches.length) {
        results.innerHTML = matches
            .map(
                (p) =>
                    `<div class="search-result-item" onclick="openProduct(${p.id}); document.getElementById('searchResults').classList.add('hidden')">
                <img src="${p.image}" alt="">
                <div><h4>${p.name}</h4><small>${p.category}</small></div>
            </div>`,
            )
            .join("");
        results.classList.remove("hidden");
    } else {
        results.classList.add("hidden");
    }
}
$("#searchBtn").onclick = () => search(true);
$("#productSearch").oninput = () => search(false);
$("#productSearch").onkeydown = (e) => {
    if (e.key === "Enter") search(true);
};
document.addEventListener("click", (e) => {
    if (!e.target.closest(".search")) {
        $("#searchResults").classList.add("hidden");
    }
});
function openProduct(id) {
    const p = PRODUCTS.find((x) => x.id == id);
    if (!p) return;
    trackRecentlyViewed(p.id);
    $("#pdCat").textContent = p.category;
    const off = Math.round((1 - p.price / p.mrp) * 100);
    
    let stockBadge = "";
    if (p.stock === 0) stockBadge = `<span class="stock-badge out-stock">Out of Stock</span>`;
    else if (p.stock < 5) stockBadge = `<span class="stock-badge low-stock">Low Stock (${p.stock} left)</span>`;
    else stockBadge = `<span class="stock-badge in-stock">In Stock</span>`;
    
    const disabled = p.stock === 0 ? "disabled" : "";
    const btnText = p.stock === 0 ? "Out of stock" : "Add to cart <b>+</b>";

    const description = `Enjoy the premium experience with ${p.name}. Sourced directly from verified brands, this product features high durability and state-of-the-art design, making it an excellent choice for your daily needs.`;

    $("#pdContent").innerHTML =
        `<img src="${p.image}" alt="${p.name}"><div class="pd-info"><h2>${p.name}</h2><p class="rating">★ ${p.rating} <i>|</i> <span>1k+ ratings</span></p><div class="price"><strong>${rupees(p.price)}</strong><del>${rupees(p.mrp)}</del><em>${off}% off</em></div><div style="margin: 10px 0">${stockBadge}</div><p>${description}</p><div class="pd-specs" style="margin-top:15px; border-top:1px dashed var(--line); padding-top:15px; font-size:12px; margin-bottom:20px;"><h4 style="margin:0 0 8px; font-size:12px; color:var(--navy);">Product Specifications</h4><table style="width:100%; border-collapse:collapse; text-align:left;"><tr style="border-bottom:1px solid var(--soft);"><td style="padding:6px 0; color:#718092; font-weight:600; width:40%;">Category</td><td style="padding:6px 0; color:var(--navy);">${p.category}</td></tr><tr style="border-bottom:1px solid var(--soft);"><td style="padding:6px 0; color:#718092; font-weight:600;">Product Code</td><td style="padding:6px 0; color:var(--navy);">QC-${p.id.toString().padStart(4, '0')}</td></tr><tr style="border-bottom:1px solid var(--soft);"><td style="padding:6px 0; color:#718092; font-weight:600;">Warranty</td><td style="padding:6px 0; color:var(--navy);">1 Year Brand Warranty</td></tr><tr style="border-bottom:1px solid var(--soft);"><td style="padding:6px 0; color:#718092; font-weight:600;">Return Policy</td><td style="padding:6px 0; color:var(--navy);">7-Day Easy Returns</td></tr><tr><td style="padding:6px 0; color:#718092; font-weight:600;">Stock Available</td><td style="padding:6px 0; color:var(--navy);">${p.stock} units</td></tr></table></div><button class="primary add" data-id="${p.id}" ${disabled}>${btnText}</button></div>`;
    $("#pdContent .add").onclick = (e) => {
        const item = cart.find((x) => x.id === p.id);
        if (item) {
            if (e.target.classList.contains("minus")) {
                item.qty--;
                if (item.qty <= 0) cart.splice(cart.indexOf(item), 1);
                renderCart();
            } else if (e.target.classList.contains("plus")) {
                if (item.qty < item.stock) {
                    item.qty++;
                    renderCart();
                    playCenterCartAnimation(document.querySelector("#pdContent .add"));
                } else {
                    toast("Cannot add more than available stock.");
                }
            }
            return;
        }
        if (p.stock > 0) {
            cart.push({ ...p, qty: 1 });
            renderCart();
            toast(`${p.name} added to cart`);
            playCenterCartAnimation(document.querySelector("#pdContent .add"));
        } else {
            toast("Out of stock.");
        }
    };
    openLayer($("#productDialog"));
    renderCart();
}

document.querySelectorAll(".card").forEach(
    (c) =>
        (c.onclick = (e) => {
            if (e.target.closest("button")) return;
            const id = c.querySelector(".add").dataset.id;
            openProduct(id);
        }),
);
function summary() {
    return `<div class="summary-box"><div><span>Items (${cart.reduce((a, x) => a + x.qty, 0)})</span><b>${rupees(subtotal())}</b></div><div><span>Coupon discount</span><b class="discount-value">− ${rupees(couponDiscount)}</b></div><div><span>Delivery</span><b>${delivery() > 0 ? rupees(delivery()) : "Free"}</b></div><div><strong>Total</strong><strong>${rupees(total())}</strong></div></div>`;
}
function checkout(step = 1) {
    if (!currentUser) {
        toast("Please sign in first.");
        return;
    }
    if (!cart.length) {
        toast("Add a product to your cart first.");
        return;
    }
    closeLayers();
    openLayer($("#checkoutDialog"));
    $("#checkoutStep").textContent = `STEP ${step} OF 3`;
    if (step === 1) {
        $("#checkoutContent").innerHTML =
            `<form class="dialog-body" id="addressForm"><h3>Delivery address</h3><p>Where should we deliver your order?</p><div class="form-grid"><label class="full">Full name<input required name="name" value="${checkoutAddress.name || ""}" placeholder="Your full name"></label><label>Mobile number<input required name="phone" pattern="[0-9]{10}" value="${checkoutAddress.phone || ""}" placeholder="10-digit mobile number"></label><label>PIN code<input required name="pin" id="pinInput" pattern="[0-9]{6}" value="${checkoutAddress.pin || ""}" placeholder="6-digit PIN code"></label><label class="full">Complete address<textarea required name="address" rows="3" placeholder="House no., street, area">${checkoutAddress.address || ""}</textarea></label><label>City<input required name="city" id="cityInput" value="${checkoutAddress.city || ""}" placeholder="City"></label><label>State<input required name="state" id="stateInput" value="${checkoutAddress.state || ""}" placeholder="State"></label></div><button class="primary">Continue to payment <b>→</b></button></form>`;
        
        document.getElementById("pinInput").addEventListener("input", async (e) => {
            const pin = e.target.value.trim();
            if (pin.length === 6 && /^[0-9]+$/.test(pin)) {
                try {
                    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                    const data = await res.json();
                    if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
                        const postOffice = data[0].PostOffice[0];
                        document.getElementById("cityInput").value = postOffice.District;
                        document.getElementById("stateInput").value = postOffice.State;
                    }
                } catch (error) {
                    console.error("Failed to fetch pincode details:", error);
                }
            }
        });
    } else if (step === 2) {
        $("#checkoutContent").innerHTML =
            `<form class="dialog-body" id="paymentForm"><h3>Choose payment method</h3><p>Review the total, apply a coupon and choose how you’ll pay.</p>${summary()}<div class="coupon"><input id="couponCode" placeholder="Coupon code" value="${couponDiscount ? "QUICK10" : ""}"><button type="button" id="applyCoupon">Apply</button></div><small class="coupon-help">Use <b>QUICK10</b> to get 10% off (up to ₹500).</small><label class="payment-option"><input type="radio" name="payment" value="UPI" checked onchange="togglePayment()"> UPI (Google Pay, PhonePe, Paytm)</label><div id="detailsUPI" style="margin-bottom:10px;padding-left:13px"><input class="payment-input" required placeholder="Enter UPI ID (e.g. name@upi)"></div><label class="payment-option"><input type="radio" name="payment" value="Card" onchange="togglePayment()"> Credit / Debit Card</label><div id="detailsCard" style="display:none;margin-bottom:10px;padding-left:13px"><input class="payment-input" required placeholder="Card Number" pattern="[0-9 ]{16,19}" style="margin-bottom:8px;display:block"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input class="payment-input" required placeholder="MM/YY"><input class="payment-input" required placeholder="CVV" type="password" pattern="[0-9]{3,4}"></div></div><label class="payment-option"><input type="radio" name="payment" value="Cash on Delivery" onchange="togglePayment()"> Cash on Delivery</label><button class="primary">Place order <b>→</b></button></form>`;
        window.togglePayment = () => {
            const val = document.querySelector(
                'input[name="payment"]:checked',
            ).value;
            const upi = document.getElementById("detailsUPI");
            const card = document.getElementById("detailsCard");
            upi.style.display = val === "UPI" ? "block" : "none";
            upi.querySelectorAll("input").forEach(
                (i) => (i.disabled = val !== "UPI"),
            );
            card.style.display = val === "Card" ? "block" : "none";
            card.querySelectorAll("input").forEach(
                (i) => (i.disabled = val !== "Card"),
            );
        };
        window.togglePayment();
    }
}
async function saveAddress() {
    const row = {
        user_id: currentUser.id,
        full_name: checkoutAddress.name,
        phone: checkoutAddress.phone,
        address: checkoutAddress.address,
        city: checkoutAddress.city,
        state: checkoutAddress.state,
        pin: checkoutAddress.pin,
        is_default: true,
    };
    let addresses = JSON.parse(localStorage.getItem("addresses") || "[]");
    addresses = addresses.filter((a) => a.user_id !== currentUser.id);
    addresses.push(row);
    localStorage.setItem("addresses", JSON.stringify(addresses));
}
async function finishOrder(payment) {
    const orderCode = `QC${Date.now().toString().slice(-8)}`;
    const order = {
        id: Date.now(),
        user_id: currentUser.id,
        order_code: orderCode,
        total: total(),
        discount: couponDiscount,
        delivery_fee: delivery(),
        payment_method: payment,
        status: "Confirmed",
        delivery_address: checkoutAddress,
        created_at: new Date().toISOString(),
    };
    const items = cart.map((x) => ({
        order_id: order.id,
        user_id: currentUser.id,
        product_id: x.id,
        product_name: x.name,
        price: x.price,
        quantity: x.qty,
    }));
    let orders = JSON.parse(localStorage.getItem("orders") || "[]");
    let orderItems = JSON.parse(localStorage.getItem("order_items") || "[]");
    orders.push(order);
    orderItems.push(...items);
    localStorage.setItem("orders", JSON.stringify(orders));
    localStorage.setItem("order_items", JSON.stringify(orderItems));
    cart.length = 0;
    if (couponDiscount > 0) {
        const usageKey = `coupon_usage_${currentUser.id}`;
        const usageCount = parseInt(localStorage.getItem(usageKey) || "0", 10);
        localStorage.setItem(usageKey, usageCount + 1);
    }
    couponDiscount = 0;
    renderCart();
    $("#checkoutStep").textContent = "ORDER CONFIRMED";
    $("#checkoutContent").innerHTML =
        `<div class="success"><div class="tick">✓</div><h2>Order successful!</h2><p>Thank you for shopping with Quick Cart.<br>Your order <b>#${orderCode}</b> has been placed.</p><p>We’ll send updates to <b>${checkoutAddress.phone}</b>.</p><button class="primary" id="trackOrder">Track my order <b>→</b></button></div>`;
    $("#trackOrder").onclick = () => {
        closeLayers();
        showOrders();
    };
}
$(".checkout").onclick = () => checkout(1);
$("#checkoutDialog").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        if (e.target.id === "addressForm") {
            checkoutAddress = Object.fromEntries(new FormData(e.target));
            await saveAddress();
            checkout(2);
        } else if (e.target.id === "paymentForm") {
            const button = e.target.querySelector("button.primary");
            button.disabled = true;
            button.textContent = "Placing order...";
            await finishOrder(new FormData(e.target).get("payment"));
        }
    } catch (error) {
        console.error(error);
        toast("Could not save your order. Please try again.");
    }
});
$("#checkoutDialog").addEventListener("click", (e) => {
    if (e.target.id === "applyCoupon") {
        const code = $("#couponCode").value.trim().toUpperCase();
        if (code === "QUICK10") {
            const usageKey = `coupon_usage_${currentUser.id}`;
            const usageCount = parseInt(localStorage.getItem(usageKey) || "0", 10);
            if (usageCount >= 3) {
                couponDiscount = 0;
                toast("You have reached the maximum of 3 uses for this coupon.");
                checkout(2);
            } else {
                couponDiscount = Math.min(Math.round(subtotal() * 0.1), 500);
                toast(`Coupon applied: ${rupees(couponDiscount)} saved`);
                checkout(2);
            }
        } else {
            couponDiscount = 0;
            toast("Invalid coupon. Try QUICK10");
        }
    }
});
document
    .querySelectorAll(".dialog-close")
    .forEach((b) => (b.onclick = closeLayers));
function updateOrderStatuses() {
    let orders = JSON.parse(localStorage.getItem("orders") || "[]");
    let changed = false;
    const now = new Date();
    
    orders.forEach((o) => {
        if (o.status && o.status.includes("Return")) return;
        
        const createdTime = new Date(o.created_at).getTime();
        const diffMs = now.getTime() - createdTime;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        let targetStatus = "Confirmed";
        if (diffDays >= 3) {
            targetStatus = "Delivered";
        } else if (diffDays >= 2) {
            targetStatus = "Shipped";
        } else if (diffDays >= 1) {
            targetStatus = "Processed";
        }
        
        if (o.status !== targetStatus) {
            o.status = targetStatus;
            changed = true;
        }
    });
    
    if (changed) {
        localStorage.setItem("orders", JSON.stringify(orders));
    }
}

async function showOrders() {
    if (!currentUser) {
        toast("Please sign in first.");
        return;
    }
    updateOrderStatuses();
    let orders = JSON.parse(localStorage.getItem("orders") || "[]")
        .filter((o) => o.user_id === currentUser.id)
        .reverse();
    let allItems = JSON.parse(localStorage.getItem("order_items") || "[]");
    let itemMap = {};
    if (orders.length) {
        allItems
            .filter((i) => orders.some((o) => o.id === i.order_id))
            .forEach((i) => (itemMap[i.order_id] ??= []).push(i));
    }
    $("#ordersContent").innerHTML = orders.length
        ? `<div class="dialog-body">${orders.map((o) => {
            const itemsHtml = (itemMap[o.id] || []).map((i) => `
                <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:5px;">
                    <span>${i.product_name} × ${i.quantity}</span>
                    <strong>${rupees(Number(i.price * i.quantity))}</strong>
                </div>
            `).join("");
            
            const createdDate = new Date(o.created_at);
            const confirmedTime = createdDate.toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true
            });
            
            const deliveryDate = new Date(o.created_at);
            deliveryDate.setDate(deliveryDate.getDate() + 3);
            const deliveryStr = deliveryDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
            });
            
            const isDelivered = o.status === 'Delivered';
            const isShipped = isDelivered || o.status === 'Shipped';
            const isProcessed = isShipped || o.status === 'Processed';
            
            return `
            <article class="order">
                <div class="order-top" style="cursor:pointer" onclick="this.parentElement.querySelector('.order-details').style.display = this.parentElement.querySelector('.order-details').style.display === 'none' ? 'block' : 'none'">
                    <strong>Order #${o.order_code}</strong>
                    <span class="status" style="color:${o.status.includes("Return") ? "#e64545" : "var(--green)"}">● ${o.status}</span>
                </div>
                <div class="order-top" style="margin-top:5px; cursor:pointer" onclick="this.parentElement.querySelector('.order-details').style.display = this.parentElement.querySelector('.order-details').style.display === 'none' ? 'block' : 'none'">
                    <span>Placed on ${createdDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <strong>${rupees(Number(o.total))}</strong>
                </div>
                <div class="order-details" style="display:none; margin-top:15px; border-top:1px dashed var(--line); padding-top:15px">
                    <h4 style="margin:0 0 10px; font-size:12px;">Order Details</h4>
                    <div style="display:flex; flex-direction:column;">
                        ${itemsHtml}
                    </div>
                </div>
                <div class="tracking-view" style="display:none; margin-top:15px; padding:15px; background:var(--soft); border-radius:8px; font-size:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px;">
                        <h4 style="margin:0; font-size:12px;">Live Tracking</h4>
                        <span style="color:var(--blue); font-weight:600; font-size:11px;">Expected Delivery: ${deliveryStr}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:15px; position:relative;">
                        <div style="position:absolute; left:5px; top:5px; bottom:5px; width:2px; background:var(--line); z-index:1;"></div>
                        
                        <div style="display:flex; align-items:center; gap:10px; z-index:2; color:var(--navy)">
                            <div style="width:12px; height:12px; border-radius:50%; background:var(--green); border:2px solid var(--soft); margin-left:-1px;"></div>
                            <div><strong>Order Confirmed</strong><br><small style="color:#718092">Confirmed on ${confirmedTime}</small></div>
                        </div>
                        
                        <div style="display:flex; align-items:center; gap:10px; z-index:2; color:${isProcessed ? 'var(--navy)' : '#8b96a2'}">
                            <div style="width:12px; height:12px; border-radius:50%; background:${isProcessed ? 'var(--green)' : 'var(--line)'}; border:2px solid var(--soft); margin-left:-1px;"></div>
                            <div><strong>Being Processed</strong><br><small style="color:#718092">Seller is preparing your order</small></div>
                        </div>
                        
                        <div style="display:flex; align-items:center; gap:10px; z-index:2; color:${isShipped ? 'var(--navy)' : '#8b96a2'}">
                            <div style="width:12px; height:12px; border-radius:50%; background:${isShipped ? 'var(--green)' : 'var(--line)'}; border:2px solid var(--soft); margin-left:-1px;"></div>
                            <div><strong>Shipped</strong><br><small style="color:#718092">Package is on the way</small></div>
                        </div>
                        
                        <div style="display:flex; align-items:center; gap:10px; z-index:2; color:${isDelivered ? 'var(--navy)' : '#8b96a2'}">
                            <div style="width:12px; height:12px; border-radius:50%; background:${isDelivered ? 'var(--green)' : 'var(--line)'}; border:2px solid var(--soft); margin-left:-1px;"></div>
                            <div><strong>Delivered</strong><br><small style="color:#718092">${isDelivered ? 'Delivered on ' + deliveryStr : 'Expected by ' + deliveryStr}</small></div>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:10px; margin-top:15px; align-items:center;">
                    <button onclick="this.parentElement.previousElementSibling.style.display = this.parentElement.previousElementSibling.style.display === 'none' ? 'block' : 'none'; this.textContent = this.parentElement.previousElementSibling.style.display === 'block' ? 'Hide tracking' : 'Track order'">Track order</button>
                    ${!o.status.includes("Return") ? `<button style="background:#fff0f0;color:#e64545" onclick="openReturnDialog(${o.id})">Return order</button>` : ""}
                    <button style="margin-left:auto; background:transparent; color:var(--blue);" onclick="const details = this.parentElement.parentElement.querySelector('.order-details'); details.style.display = details.style.display === 'none' ? 'block' : 'none'; this.textContent = details.style.display === 'block' ? 'Hide Details' : 'View Details'">View Details</button>
                </div>
            </article>`;
        }).join("")}</div>`
        : '<p class="no-orders">No orders yet.<br>Once you place an order, you can track it here.</p>';
    openLayer($("#ordersDialog"));
}
function showWishlist() {
    if (!currentUser) {
        showAuthGate();
        return;
    }
    const favs = JSON.parse(localStorage.getItem(`favs_${currentUser.id}`) || "[]");
    let content = "";
    if (favs.length === 0) {
        content = '<p class="no-orders" style="padding:40px;text-align:center;color:var(--navy)">Your wishlist is empty.<br>Click the heart icon on a product to save it here.</p>';
    } else {
        const wishlistProducts = PRODUCTS.filter(p => favs.includes(p.id));
        content = `<div class="order-list" style="padding:20px;display:grid;gap:15px">` + 
        wishlistProducts.map(p => {
            return `<article style="display:flex;align-items:center;gap:15px;padding-bottom:15px;border-bottom:1px solid var(--line);">
                <img src="${p.image}" alt="" style="width:60px;height:70px;object-fit:cover;border-radius:5px">
                <div style="flex:1">
                    <h4 style="margin:0 0 5px;font-size:14px">${p.name}</h4>
                    <strong style="color:var(--navy)">₹${p.price.toLocaleString()}</strong>
                </div>
                <button class="add" data-id="${p.id}" onclick="event.stopPropagation(); cartAdd(${p.id});" style="padding:8px 12px;background:var(--blue);color:#fff;border-radius:4px;border:none;cursor:pointer;font-weight:bold;font-size:12px;white-space:nowrap;flex-shrink:0;width:max-content;">Add to Cart</button>
            </article>`;
        }).join("") + `</div>`;
    }
    $("#wishlistContent").innerHTML = content;
    openLayer($("#wishlistDialog"));
}
$("#wishlistBtn").onclick = showWishlist;
$("#ordersBtn").onclick = showOrders;
$("#footerOrders").onclick = (e) => {
    e.preventDefault();
    showOrders();
};
window.openReturnDialog = (id) => {
    $("#returnOrderId").value = id;
    openLayer($("#returnDialog"));
};
$("#returnForm").onsubmit = (e) => {
    e.preventDefault();
    const id = Number($("#returnOrderId").value);
    let orders = JSON.parse(localStorage.getItem("orders") || "[]");
    const o = orders.find((x) => x.id === id);
    if (o) {
        o.status = "Return Requested";
        localStorage.setItem("orders", JSON.stringify(orders));
        toast("Return request submitted successfully.");
        e.target.reset();
        closeLayers();
        showOrders();
    }
};
let signedUp = false;
let pendingAuth = null;
let verificationTimer = null;
let resendCooldownTimer = null;

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatDisplayName(name, email) {
    if (name && name.trim()) return name.trim();
    const prefix = (email || "").split("@")[0] || "Shopper";
    return prefix
        .replace(/[._-]+/g, " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function startVerificationCountdown(expiresAt) {
    if (verificationTimer) clearInterval(verificationTimer);
    function update() {
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        const timeStr = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        const cdEl = $("#verifyCountdown");
        if (cdEl) {
            cdEl.textContent = `Expires in ${timeStr}`;
            if (remaining <= 0) {
                cdEl.textContent = "Code expired. Request a new one.";
                cdEl.style.color = "#e64545";
            } else {
                cdEl.style.color = "#6f7f90";
            }
        }
        if (remaining <= 0) {
            clearInterval(verificationTimer);
        }
    }
    update();
    verificationTimer = setInterval(update, 1000);
}

function resetResendCooldown() {
    const btn = $("#resendCodeBtn");
    if (!btn) return;
    btn.disabled = true;
    let cd = 30;
    btn.textContent = `Resend in ${cd}s`;
    btn.style.color = "#a0aec0";
    btn.style.cursor = "not-allowed";
    if (resendCooldownTimer) clearInterval(resendCooldownTimer);
    resendCooldownTimer = setInterval(() => {
        cd--;
        if (cd <= 0) {
            clearInterval(resendCooldownTimer);
            btn.disabled = false;
            btn.textContent = "Resend email";
            btn.style.color = "var(--blue)";
            btn.style.cursor = "pointer";
        } else {
            btn.textContent = `Resend in ${cd}s`;
        }
    }, 1000);
}

async function initiateEmailVerification({ mode, email, name, password, userObj }) {
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const displayName = formatDisplayName(name || (userObj && userObj.name), email);

    // Show loading toast
    toast(`⏳ Sending verification email to ${email}...`);

    try {
        const resp = await fetch("send_verification.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "send",
                email: email,
                name: displayName,
                type: mode,
            }),
        });
        const result = await resp.json();

        if (!resp.ok || !result.success) {
            throw new Error(result.error || result.message || "Failed to send email");
        }

        pendingAuth = {
            mode,
            email,
            name: displayName,
            password,
            userObj,
            expiresAt,
        };

        // Transition AuthGate form to Verification View
        $("#authForm").style.display = "none";
        $("#savedAccounts").style.display = "none";
        $("#authSwitch").style.display = "none";
        $("#verifyForm").style.display = "block";
        $("#verifyTargetEmail").textContent = email;
        $("#authTitle").textContent = "Verify your email";
        $("#authText").textContent = `Please enter the 6-digit code sent to ${email} to complete verification.`;

        // Clear and focus OTP inputs
        const digits = document.querySelectorAll(".otp-digit");
        digits.forEach((d) => (d.value = ""));
        if (digits[0]) setTimeout(() => digits[0].focus(), 60);

        startVerificationCountdown(expiresAt);
        resetResendCooldown();

        toast(`📨 Verification code sent to ${email}! Check your inbox.`);
    } catch (err) {
        toast(`⚠️ ${err.message}`);
        console.error("Email send error:", err);
    }
}

function setupOtpInputs() {
    const digits = document.querySelectorAll(".otp-digit");
    digits.forEach((input, idx) => {
        input.addEventListener("input", (e) => {
            const val = e.target.value.replace(/[^0-9]/g, "");
            e.target.value = val ? val[0] : "";
            if (val && idx < digits.length - 1) {
                digits[idx + 1].focus();
            }
            const full = Array.from(digits)
                .map((d) => d.value)
                .join("");
            if (full.length === 6) {
                $("#verifyForm").dispatchEvent(new Event("submit"));
            }
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !e.target.value && idx > 0) {
                digits[idx - 1].focus();
            }
        });

        input.addEventListener("paste", (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData)
                .getData("text")
                .replace(/[^0-9]/g, "");
            if (text.length >= 6) {
                digits.forEach((d, i) => {
                    d.value = text[i] || "";
                });
                digits[digits.length - 1].focus();
                $("#verifyForm").dispatchEvent(new Event("submit"));
            }
        });
    });
}

$("#authSwitch").onclick = () => {
    signedUp = !signedUp;
    $("#authTitle").textContent = signedUp
        ? "Create your account"
        : "Welcome back";
    $("#authText").textContent = signedUp
        ? "Sign up to enjoy a more personal shopping experience."
        : "Sign in to shop, save your favourites and track every order.";
    $("#authSwitch").innerHTML = signedUp
        ? "Already have an account? <button type='button'>Sign in</button>"
        : "New to Quick Cart? <button type='button'>Sign up</button>";
    $("#authNameLabel").style.display = signedUp ? "block" : "none";
    if (signedUp && !$("#authName").value) {
        $("#authName").value = "Dinesh Ragul S";
    }
};

$("#authForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#authEmail").value.trim(),
        password = $("#authPassword").value;
    try {
        if (!email || !email.includes("@")) throw new Error("Please enter a valid email address");
        if (password.length < 4) throw new Error("Password must be at least 4 characters");
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        let user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (signedUp) {
            if (user) throw new Error("An account with this email already exists");
            const fullName = $("#authName").value.trim() || "Dinesh Ragul S";
            if (REQUIRE_EMAIL_VERIFICATION) {
                await initiateEmailVerification({
                    mode: "signup",
                    email: email,
                    name: fullName,
                    password: password,
                });
            } else {
                user = { id: Date.now().toString(), name: fullName, email, password };
                users.push(user);
                localStorage.setItem("users", JSON.stringify(users));
                toast("Account created. Welcome to Quick Cart!");
                await setUser(user);
            }
        } else {
            if (!user || user.password !== password)
                throw new Error("Invalid email or password");
            if (REQUIRE_EMAIL_VERIFICATION) {
                await initiateEmailVerification({
                    mode: "login",
                    email: user.email,
                    name: user.name || user.email.split("@")[0],
                    password: password,
                    userObj: user,
                });
            } else {
                toast("Welcome back!");
                await setUser(user);
            }
        }
    } catch (error) {
        toast(error.message);
    }
};

$("#verifyForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!pendingAuth) {
        toast("No active verification session");
        return;
    }
    if (Date.now() > pendingAuth.expiresAt) {
        toast("Verification code expired. Please click Resend email.");
        return;
    }
    const digits = document.querySelectorAll(".otp-digit");
    const enteredCode = Array.from(digits)
        .map((d) => d.value)
        .join("");
    if (enteredCode.length !== 6) {
        toast("Please enter the complete 6-digit code from your email.");
        return;
    }

    toast("⏳ Verifying code...");
    try {
        const resp = await fetch("send_verification.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "verify",
                email: pendingAuth.email,
                code: enteredCode,
            }),
        });
        const result = await resp.json();
        if (!resp.ok || !result.success) {
            digits.forEach((d) => {
                d.style.borderColor = "#e64545";
                setTimeout(() => (d.style.borderColor = ""), 1500);
            });
            throw new Error(result.error || "Invalid or expired verification code");
        }

        if (verificationTimer) clearInterval(verificationTimer);

        const users = JSON.parse(localStorage.getItem("users") || "[]");
        if (pendingAuth.mode === "signup") {
            const newUser = {
                id: Date.now().toString(),
                name: pendingAuth.name,
                email: pendingAuth.email,
                password: pendingAuth.password,
                verified: true,
                verifiedAt: new Date().toISOString(),
            };
            users.push(newUser);
            localStorage.setItem("users", JSON.stringify(users));
            toast(`🎉 Email verified! Welcome, ${pendingAuth.name}!`);
            await setUser(newUser);
        } else {
            let user = pendingAuth.userObj || users.find((u) => u.email === pendingAuth.email);
            if (user) {
                user.verified = true;
                localStorage.setItem("users", JSON.stringify(users));
                toast(`🎉 Email verified! Welcome back, ${pendingAuth.name}!`);
                await setUser(user);
            }
        }
        pendingAuth = null;
        $("#verifyForm").style.display = "none";
        $("#authForm").style.display = "block";
        $("#authSwitch").style.display = "block";
    } catch (err) {
        toast(`❌ ${err.message}`);
    }
};

$("#resendCodeBtn").onclick = async () => {
    if (!pendingAuth) return;
    toast(`⏳ Resending verification code to ${pendingAuth.email}...`);

    try {
        const resp = await fetch("send_verification.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "send",
                email: pendingAuth.email,
                name: pendingAuth.name,
                type: pendingAuth.mode,
            }),
        });
        const result = await resp.json();
        if (!resp.ok || !result.success) {
            throw new Error(result.error || "Failed to resend email");
        }

        pendingAuth.expiresAt = Date.now() + 10 * 60 * 1000;
        const digits = document.querySelectorAll(".otp-digit");
        digits.forEach((d) => (d.value = ""));
        if (digits[0]) digits[0].focus();

        startVerificationCountdown(pendingAuth.expiresAt);
        resetResendCooldown();
        toast(`📨 New verification code sent to your email!`);
    } catch (err) {
        toast(`⚠️ ${err.message}`);
    }
};

$("#backToCredsBtn").onclick = () => {
    if (verificationTimer) clearInterval(verificationTimer);
    pendingAuth = null;
    $("#verifyForm").style.display = "none";
    $("#authForm").style.display = "block";
    $("#authSwitch").style.display = "block";
    $("#authTitle").textContent = signedUp
        ? "Create your account"
        : "Welcome back";
    $("#authText").textContent = signedUp
        ? "Sign up to enjoy a more personal shopping experience."
        : "Sign in to shop, save your favourites and track every order.";
};

$("#skipAuthBtn").onclick = () => {
    if (!currentUser) {
        sessionStorage.setItem("skipAuth", "true");
        $("#authGate").classList.add("hidden");
        toast("Browsing as guest");
    }
};
$("#accountBtn").onclick = () => {
    if (!currentUser) {
        signedUp = false;
        showAuthGate();
        return;
    }
    const name = currentUser.name || currentUser.email.split("@")[0];
    $("#userNameDisplay").textContent = "Hi, " + name + "!";
    $("#userEmailDisplay").textContent = currentUser.email;
    closeLayers();
    openLayer($("#userDialog"));
};
$("#logoutBtn").onclick = () => {
    currentUser = null;
    favouriteIds = [];
    localStorage.removeItem("currentUser");
    $("#accountBtn").innerHTML = "♙ <span>Account</span>";
    renderFavourites();
    closeLayers();
    toast("You have been logged out.");
};
$("#switchAccountBtn").onclick = () => {
    $("#logoutBtn").click();
    showAuthGate();
};
$("#newsletter").onsubmit = (e) => {
    e.preventDefault();
    $("#subscribeMessage").textContent = "Thanks! You are subscribed.";
    e.target.reset();
};
$("#menuBtn").onclick = () => {
    if ($("#mobileMenu").classList.contains("open")) {
        closeLayers();
    } else {
        openLayer($("#mobileMenu"));
    }
};
$("#closeMenu").onclick = closeLayers;
document.getElementById('menuWishlistBtn')?.addEventListener('click', (e) => { e.preventDefault(); closeLayers(); showWishlist(); });
document.getElementById('menuOrdersBtn')?.addEventListener('click', (e) => { e.preventDefault(); closeLayers(); showOrders(); });
document.getElementById('menuAccountBtn')?.addEventListener('click', (e) => { e.preventDefault(); closeLayers(); document.getElementById('accountBtn').click(); });
$("#closeTopbar").onclick = () => {
    $(".topbar").style.display = "none";
};
initApp();

document.getElementById('priceFilter')?.addEventListener('change', () => { const active = document.querySelector('.chips button.active'); applyFilter(active ? active.dataset.filter : 'All'); });
document.getElementById('sortFilter')?.addEventListener('change', () => { const active = document.querySelector('.chips button.active'); applyFilter(active ? active.dataset.filter : 'All'); });

window.addEventListener('DOMContentLoaded', () => { const params = new URLSearchParams(window.location.search); const cat = params.get('category'); if (cat) { const btn = document.querySelector('.chips button[data-filter="' + cat + '"]'); if (btn) { applyFilter(cat); setTimeout(() => document.getElementById('products').scrollIntoView({behavior: 'smooth'}), 100); } } });


function trackRecentlyViewed(id) {
    let recent = JSON.parse(localStorage.getItem('recent_products') || "[]");
    recent = recent.filter(x => x !== id);
    recent.unshift(id);
    if (recent.length > 5) recent.pop();
    localStorage.setItem('recent_products', JSON.stringify(recent));
    renderRecentlyViewed();
}

function renderRecentlyViewed() {
    const recentIds = JSON.parse(localStorage.getItem('recent_products') || "[]");
    const section = document.getElementById("recentlyViewedSection");
    const grid = document.getElementById("recentlyViewedGrid");
    if (!section || !grid) return;
    
    if (recentIds.length === 0) {
        section.style.display = "none";
        return;
    }
    
    section.style.display = "block";
    const productsToRender = recentIds.map(id => PRODUCTS.find(p => p.id == id)).filter(Boolean);
    grid.innerHTML = productsToRender.map(p => {
        const off = Math.round((1 - p.price / p.mrp) * 100);
        return `<article class="card" onclick="openProduct(${p.id})">
            <div class="image-wrap"><img src="${p.image}" alt=""></div>
            <div class="product-details">
                <p class="category">${p.category}</p>
                <h3>${p.name}</h3>
                <p class="rating">★ ${p.rating} <i>|</i> <span>1k+ ratings</span></p>
                <div class="price"><strong>₹${p.price.toLocaleString()}</strong><del>₹${p.mrp.toLocaleString()}</del><em>${off}% off</em></div>
            </div>
            <button class="add" data-id="${p.id}" onclick="event.stopPropagation(); openProduct(${p.id})">View Details</button>
        </article>`;
    }).join("");
}

window.addEventListener('DOMContentLoaded', renderRecentlyViewed);
