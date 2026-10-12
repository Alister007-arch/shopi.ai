import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text,
    DateTime, ForeignKey, func, Index
)
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    phone_consent = Column(Boolean, default=False, nullable=True)
    phone_consent_at = Column(DateTime, nullable=True)
    role = Column(String(50), default="customer", nullable=False)  # 'customer' | 'admin'
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    addresses = relationship("UserAddress", back_populates="user", cascade="all, delete-orphan")
    cart_items = relationship("CartItem", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)
    parent_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    policy_group = Column(String(50), default="default", nullable=False)
    display_order = Column(Integer, default=0, nullable=False)

    parent = relationship("Category", remote_side=[id], backref="children")
    products = relationship("Product", back_populates="category_rel")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    subcategory = Column(String(100), nullable=True)
    brand = Column(String(100), default="Trovi Curated", nullable=False)
    price = Column(Float, nullable=False)
    price_inr = Column(Integer, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    description = Column(Text, nullable=True)
    attributes = Column(Text, nullable=True)
    specifications = Column(Text, nullable=True)
    stock = Column(Integer, default=10, nullable=False)
    is_organic = Column(Boolean, default=False, nullable=False)
    image_url = Column(String(500), nullable=False)
    badge = Column(String(100), nullable=True)
    version = Column(Integer, default=1, nullable=False)  # Optimistic concurrency lock
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    category_rel = relationship("Category", back_populates="products")

    __table_args__ = (
        Index("idx_products_cat_stock", "category", "stock"),
        Index("idx_products_category_id", "category_id"),
    )


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=False, index=True)
    customer_address = Column(Text, nullable=False)
    items_summary = Column(Text, nullable=False)
    subtotal = Column(Float, nullable=False)
    subtotal_inr = Column(Integer, nullable=False)
    delivery_fee = Column(Float, default=0.0, nullable=False)
    delivery_fee_inr = Column(Integer, default=0, nullable=False)
    total_price = Column(Float, nullable=False)
    total_price_inr = Column(Integer, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    status = Column(String(50), default="Confirmed", nullable=False)
    payment_method = Column(String(50), default="Demo Pay / COD", nullable=False)
    billing_address = Column(Text, nullable=True)
    buyer_gstin = Column(String(50), nullable=True)
    buyer_company = Column(String(255), nullable=True)
    discount_inr = Column(Integer, default=0, nullable=False)
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    ordered_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, nullable=False)
    product_name = Column(String(255), nullable=False)
    unit_price = Column(Float, nullable=False)
    unit_price_inr = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False)
    total_price = Column(Float, nullable=False)
    total_price_inr = Column(Integer, nullable=False)

    order = relationship("Order", back_populates="items")


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    key = Column(String(100), primary_key=True, index=True)
    order_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class AgentQuote(Base):
    __tablename__ = "agent_quotes"

    id = Column(Integer, primary_key=True, index=True)
    quote_token = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    items_json = Column(Text, nullable=False)
    total_inr = Column(Integer, nullable=False)
    target_budget_inr = Column(Integer, nullable=True)
    is_confirmed = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class AgentTrace(Base):
    __tablename__ = "agent_traces"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(String(100), index=True, nullable=False)
    user_message = Column(Text, nullable=False)
    agent_reply = Column(Text, nullable=False)
    tool_calls = Column(Text, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class UserAddress(Base):
    __tablename__ = "user_addresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tag = Column(String(50), default="home", nullable=False)  # 'home' | 'office' | 'college' | 'other'
    title = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    flat = Column(String(255), nullable=False)
    street = Column(String(255), nullable=False)
    landmark = Column(String(255), nullable=True)
    city = Column(String(100), default="Bengaluru", nullable=False)
    state = Column(String(100), default="Karnataka", nullable=False)
    pin_code = Column(String(10), nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="addresses")
 
 
class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="cart_items")
    product = relationship("Product")


class OrderAuditLog(Base):
    __tablename__ = "order_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, nullable=True)
    order_number = Column(String(50), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)
    old_state = Column(String(50), nullable=True)
    new_state = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    performed_by = Column(String(50), default="customer", nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(50), unique=True, index=True, nullable=False)
    order_number = Column(String(50), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    issue_type = Column(String(100), nullable=False)
    status = Column(String(50), default="needs_human_review", nullable=False)
    description = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    refund_amount_inr = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class ActionConfirmationToken(Base):
    __tablename__ = "action_confirmation_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, nullable=False)
    order_number = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)
    payload_json = Column(Text, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    phone = Column(String(50), nullable=True)
    channel = Column(String(50), default="email", nullable=False)  # 'email' | 'sms' | 'whatsapp'
    code = Column(String(20), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


