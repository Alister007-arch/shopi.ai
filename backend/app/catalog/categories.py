"""
Hierarchical Category Tree, Policy Group Mappings, and Category-Specific Attribute Schemas
for MOSS Multi-Category E-Commerce Platform.
"""

from typing import Dict, List, Any, Optional

CATEGORY_TREE: List[Dict[str, Any]] = [
    {
        "id": 1,
        "name": "Grocery & Gourmet",
        "slug": "grocery",
        "description": "Artisan pantry, farm-fresh produce, single-origin honey, superfoods, and MOSS Organics collection.",
        "icon": "ShoppingBag",
        "policy_group": "packaged_food",
        "display_order": 1,
        "children": [
            {"id": 101, "name": "Honey & Spreads", "slug": "honey", "policy_group": "packaged_food", "display_order": 1},
            {"id": 102, "name": "Oats & Cereals", "slug": "oats", "policy_group": "packaged_food", "display_order": 2},
            {"id": 103, "name": "Cooking Oils", "slug": "oil", "policy_group": "packaged_food", "display_order": 3},
            {"id": 104, "name": "Nuts & Dry Fruits", "slug": "nuts", "policy_group": "packaged_food", "display_order": 4},
            {"id": 105, "name": "Superfood Seeds", "slug": "seeds", "policy_group": "packaged_food", "display_order": 5},
            {"id": 106, "name": "Grains & Rice", "slug": "grains", "policy_group": "packaged_food", "display_order": 6},
            {"id": 107, "name": "Teas & Infusions", "slug": "tea", "policy_group": "packaged_food", "display_order": 7},
            {"id": 108, "name": "Coffee & Beans", "slug": "coffee", "policy_group": "packaged_food", "display_order": 8},
            {"id": 109, "name": "Healthy Snacks", "slug": "snacks", "policy_group": "packaged_food", "display_order": 9},
            {"id": 110, "name": "Plant & Dairy Alt", "slug": "dairy-alt", "policy_group": "packaged_food", "display_order": 10},
            {"id": 111, "name": "Daily Essentials & Staples", "slug": "daily-essentials", "policy_group": "packaged_food", "display_order": 11},
            {"id": 112, "name": "Fresh Fruits & Vegetables", "slug": "fruits-vegetables", "policy_group": "fresh_produce", "display_order": 12},
            {"id": 113, "name": "Farm Produce", "slug": "produce", "policy_group": "fresh_produce", "display_order": 13},
            {"id": 114, "name": "Pantry Groceries", "slug": "groceries", "policy_group": "packaged_food", "display_order": 14},
        ],
    },
    {
        "id": 2,
        "name": "Fashion & Apparel",
        "slug": "fashion",
        "description": "Premium apparel, organic cotton basics, tailored linen, breathable footwear, and comfort innerwear.",
        "icon": "Shirt",
        "policy_group": "clothing",
        "display_order": 2,
        "children": [
            {"id": 201, "name": "Clothing & Outerwear", "slug": "clothing", "policy_group": "clothing", "display_order": 1},
            {"id": 202, "name": "Apparel & Accessories", "slug": "apparel", "policy_group": "clothing", "display_order": 2},
            {"id": 203, "name": "Innerwear & Loungewear", "slug": "innerwear", "policy_group": "innerwear", "display_order": 3},
        ],
    },
    {
        "id": 3,
        "name": "Electronics",
        "slug": "electronics",
        "description": "High-fidelity audio, wireless headphones, smart wearables, fast-charging accessories, and smart devices.",
        "icon": "Cpu",
        "policy_group": "electronics",
        "display_order": 3,
        "children": [
            {"id": 301, "name": "Audio & Headphones", "slug": "audio", "policy_group": "electronics", "display_order": 1},
            {"id": 302, "name": "Smart Devices & Wearables", "slug": "gadgets", "policy_group": "electronics", "display_order": 2},
            {"id": 304, "name": "Headphones & Audio Gear", "slug": "headphones", "policy_group": "electronics", "display_order": 4},
        ],
    },
    {
        "id": 4,
        "name": "Laptops & Computing",
        "slug": "laptops",
        "description": "High-performance developer laptops, lightweight ultrabooks, workstations, and student productivity notebooks.",
        "icon": "Laptop",
        "policy_group": "laptops",
        "display_order": 4,
        "children": [
            {"id": 401, "name": "Developer Ultrabooks", "slug": "ultrabooks", "policy_group": "laptops", "display_order": 1},
            {"id": 402, "name": "Power Workstations", "slug": "workstations", "policy_group": "laptops", "display_order": 2},
            {"id": 403, "name": "Student Notebooks", "slug": "student-laptops", "policy_group": "laptops", "display_order": 3},
        ],
    },
    {
        "id": 5,
        "name": "Home & Kitchen",
        "slug": "home-kitchen",
        "description": "Heavy-duty blenders, heirloom cast iron cookware, induction appliances, stainless steel drinkware, and eco cleaning.",
        "icon": "Home",
        "policy_group": "home_kitchen",
        "display_order": 5,
        "children": [
            {"id": 501, "name": "Kitchen Appliances", "slug": "kitchen-appliances", "policy_group": "home_kitchen", "display_order": 1},
            {"id": 502, "name": "Cookware & Dining", "slug": "cookware", "policy_group": "home_kitchen", "display_order": 2},
            {"id": 503, "name": "Household & Cleaning", "slug": "household", "policy_group": "household", "display_order": 3},
        ],
    },
    {
        "id": 6,
        "name": "Personal Care",
        "slug": "personal-care",
        "description": "Botanical haircare, mineral SPF skincare, multi-grooming trimmers, oral health, and dermatological essentials.",
        "icon": "Sparkles",
        "policy_group": "personal_care",
        "display_order": 6,
        "children": [
            {"id": 601, "name": "Haircare & Scalp", "slug": "haircare", "policy_group": "personal_care", "display_order": 1},
            {"id": 602, "name": "Skincare & Sunscreen", "slug": "skincare", "policy_group": "personal_care", "display_order": 2},
            {"id": 603, "name": "Grooming & Trimmers", "slug": "grooming", "policy_group": "personal_care", "display_order": 3},
        ],
    },
    {
        "id": 7,
        "name": "Luxury & Premium",
        "slug": "luxury",
        "description": "Haute horlogerie, flagship titanium smartphones, bespoke private blend perfumery, and certified luxury goods.",
        "icon": "Crown",
        "policy_group": "luxury",
        "display_order": 7,
        "children": [
            {"id": 701, "name": "Luxury Smartphones", "slug": "luxury-smartphones", "policy_group": "luxury", "display_order": 1},
            {"id": 702, "name": "Luxury Computing", "slug": "luxury-computing", "policy_group": "luxury", "display_order": 2},
            {"id": 703, "name": "Haute Horlogerie", "slug": "haute-horlogerie", "policy_group": "luxury", "display_order": 3},
            {"id": 704, "name": "Niche Fragrance", "slug": "niche-fragrance", "policy_group": "luxury", "display_order": 4},
        ],
    },
]

# Per-category attribute schemas as mandated by Requirement 3:
# - grocery: weight/pack size, organic, certification, shelf life
# - clothing: size, color, material
# - laptops: processor, RAM, storage, display, battery
# - electronics: warranty, connectivity
# - home_kitchen: material, power
# - personal_care: volume, skin_type
# - luxury: authenticity_certificate, chassis_material
CATEGORY_ATTRIBUTE_SCHEMAS: Dict[str, List[Dict[str, Any]]] = {
    "grocery": [
        {
            "key": "weight",
            "label": "Weight / Pack Size",
            "type": "select",
            "options": ["250g", "400g", "450g", "500g", "1kg", "3kg", "5kg", "750ml", "1 Liter"],
        },
        {
            "key": "is_organic",
            "label": "Organic Certified",
            "type": "boolean",
        },
        {
            "key": "certification",
            "label": "Certification",
            "type": "select",
            "options": ["India Organic", "USDA Organic", "Jaivik Bharat", "FSSAI Certified", "ISO 3632 Category 1", "Silk Mark"],
        },
        {
            "key": "shelf_life",
            "label": "Shelf Life",
            "type": "select",
            "options": ["2 Days", "5 Days", "7 Days", "14 Days", "30 Days", "6 Months", "12 Months", "24 Months"],
        },
    ],
    "fashion": [
        {
            "key": "size",
            "label": "Size",
            "type": "select",
            "options": ["XS", "S", "M", "L", "XL", "XXL", "30", "32", "34", "36"],
        },
        {
            "key": "color",
            "label": "Color",
            "type": "select",
            "options": ["Black", "White", "Navy", "Grey", "Heather Grey", "Indigo", "Khaki", "Sage Green"],
        },
        {
            "key": "material",
            "label": "Material",
            "type": "select",
            "options": ["100% GOTS Organic Cotton", "French Flax Linen", "Bamboo Viscose", "Mulberry Silk", "Merino Wool", "Denim Cotton", "Recycled Mesh"],
        },
    ],
    "clothing": [
        {
            "key": "size",
            "label": "Size",
            "type": "select",
            "options": ["XS", "S", "M", "L", "XL", "XXL", "30", "32", "34", "36"],
        },
        {
            "key": "color",
            "label": "Color",
            "type": "select",
            "options": ["Black", "White", "Navy", "Grey", "Heather Grey", "Indigo", "Khaki", "Sage Green"],
        },
        {
            "key": "material",
            "label": "Material",
            "type": "select",
            "options": ["100% GOTS Organic Cotton", "French Flax Linen", "Bamboo Viscose", "Mulberry Silk", "Merino Wool", "Denim Cotton", "Recycled Mesh"],
        },
    ],
    "innerwear": [
        {
            "key": "size",
            "label": "Size",
            "type": "select",
            "options": ["S", "M", "L", "XL", "XXL", "32B", "34B", "36B", "38C"],
        },
        {
            "key": "pack_size",
            "label": "Pack Size",
            "type": "select",
            "options": ["Pack of 2", "Pack of 3", "Pack of 5"],
        },
        {
            "key": "material",
            "label": "Fabric",
            "type": "select",
            "options": ["95% Organic Bamboo Viscose", "100% Super-Combed Cotton", "Merino Wool Blend"],
        },
    ],
    "laptops": [
        {
            "key": "processor",
            "label": "Processor",
            "type": "select",
            "options": ["Intel Core i3", "Intel Core i7", "AMD Ryzen 7", "Apple M3 Max"],
        },
        {
            "key": "ram",
            "label": "RAM",
            "type": "select",
            "options": ["8GB", "16GB", "32GB", "36GB", "64GB"],
        },
        {
            "key": "storage",
            "label": "Storage",
            "type": "select",
            "options": ["256GB SSD", "512GB SSD", "1TB SSD"],
        },
        {
            "key": "display",
            "label": "Display",
            "type": "select",
            "options": ["13.3-inch FHD", "14-inch IPS FHD", "15.6-inch QHD 165Hz", "16.2-inch Liquid Retina XDR"],
        },
        {
            "key": "battery",
            "label": "Battery Life",
            "type": "select",
            "options": ["Up to 10 Hours", "Up to 12 Hours", "Up to 22 Hours"],
        },
    ],
    "electronics": [
        {
            "key": "warranty",
            "label": "Warranty",
            "type": "select",
            "options": ["1 Year Brand Warranty", "2 Year Brand Warranty", "6 Months Warranty"],
        },
        {
            "key": "connectivity",
            "label": "Connectivity",
            "type": "select",
            "options": ["Bluetooth 5.3", "Wi-Fi 6 + Bluetooth", "USB-C Fast Charge", "Thunderbolt 4", "Wireless + 3.5mm"],
        },
    ],
    "home_kitchen": [
        {
            "key": "material",
            "label": "Material / Build",
            "type": "select",
            "options": ["Heavy-Gauge Cast Iron", "Food-Grade Stainless Steel", "Ceramic Glass", "BPA-Free Tritan"],
        },
        {
            "key": "power",
            "label": "Power Rating",
            "type": "select",
            "options": ["750 Watts", "900 Watts", "1200 Watts", "1500 Watts"],
        },
    ],
    "home-kitchen": [
        {
            "key": "material",
            "label": "Material / Build",
            "type": "select",
            "options": ["Heavy-Gauge Cast Iron", "Food-Grade Stainless Steel", "Ceramic Glass", "BPA-Free Tritan"],
        },
        {
            "key": "power",
            "label": "Power Rating",
            "type": "select",
            "options": ["750 Watts", "900 Watts", "1200 Watts", "1500 Watts"],
        },
    ],
    "personal_care": [
        {
            "key": "volume",
            "label": "Volume / Size",
            "type": "select",
            "options": ["100ml", "200ml", "300ml", "500ml"],
        },
        {
            "key": "skin_type",
            "label": "Target / Type",
            "type": "select",
            "options": ["All Skin Types", "Sensitive Skin", "Dandruff & Scalp", "UV Protection"],
        },
    ],
    "personal-care": [
        {
            "key": "volume",
            "label": "Volume / Size",
            "type": "select",
            "options": ["100ml", "200ml", "300ml", "500ml"],
        },
        {
            "key": "skin_type",
            "label": "Target / Type",
            "type": "select",
            "options": ["All Skin Types", "Sensitive Skin", "Dandruff & Scalp", "UV Protection"],
        },
    ],
    "luxury": [
        {
            "key": "authenticity_certificate",
            "label": "Authenticity Certificate",
            "type": "boolean",
        },
        {
            "key": "chassis_material",
            "label": "Chassis / Case",
            "type": "select",
            "options": ["Grade 5 Titanium", "Oystersteel 904L", "Deep Black Resin", "Monogram Canvas"],
        },
    ],
}


def get_all_categories_flat() -> List[Dict[str, Any]]:
    """Returns a flat list of all categories (both parents and subcategories) with parent_id."""
    flat_list = []
    for parent in CATEGORY_TREE:
        flat_list.append({
            "id": parent["id"],
            "name": parent["name"],
            "slug": parent["slug"],
            "description": parent.get("description"),
            "icon": parent.get("icon"),
            "parent_id": None,
            "policy_group": parent["policy_group"],
            "display_order": parent.get("display_order", 0),
        })
        for child in parent.get("children", []):
            flat_list.append({
                "id": child["id"],
                "name": child["name"],
                "slug": child["slug"],
                "description": child.get("description"),
                "icon": child.get("icon"),
                "parent_id": parent["id"],
                "policy_group": child["policy_group"],
                "display_order": child.get("display_order", 0),
            })
    return flat_list


def get_category_tree() -> List[Dict[str, Any]]:
    """Returns the nested category tree."""
    return CATEGORY_TREE


def get_category_by_slug(slug: str) -> Optional[Dict[str, Any]]:
    """Finds a category by its slug from either parents or children."""
    slug_clean = (slug or "").lower().strip()
    for cat in get_all_categories_flat():
        if cat["slug"].lower() == slug_clean:
            return cat
    return None


def get_policy_group_for_category(category_name_or_slug: Optional[str]) -> str:
    """
    Resolves the exact policy_group from policies.yaml for any category slug or name.
    Guarantees every category maps to a valid policy_group.
    """
    if not category_name_or_slug:
        return "default"
    
    clean = category_name_or_slug.lower().strip()
    cat = get_category_by_slug(clean)
    if cat and cat.get("policy_group"):
        return cat["policy_group"]

    # Direct keyword fallbacks for loose category strings
    keyword_map = {
        "laptop": "laptops",
        "notebook": "laptops",
        "workstation": "laptops",
        "phone": "electronics",
        "audio": "electronics",
        "headphone": "electronics",
        "earbud": "electronics",
        "smartwatch": "electronics",
        "innerwear": "innerwear",
        "underwear": "innerwear",
        "boxer": "innerwear",
        "bra": "innerwear",
        "vest": "innerwear",
        "cloth": "clothing",
        "apparel": "clothing",
        "fashion": "clothing",
        "dress": "clothing",
        "pant": "clothing",
        "jean": "clothing",
        "shirt": "clothing",
        "luxury": "luxury",
        "watch": "luxury",
        "rolex": "luxury",
        "fragrance": "luxury",
        "kitchen": "home_kitchen",
        "cookware": "home_kitchen",
        "appliance": "home_kitchen",
        "household": "household",
        "cleaning": "household",
        "personal": "personal_care",
        "shampoo": "personal_care",
        "sunscreen": "personal_care",
        "skincare": "personal_care",
        "haircare": "personal_care",
        "fruit": "fresh_produce",
        "vegetable": "fresh_produce",
        "produce": "fresh_produce",
        "milk": "fresh_produce",
        "egg": "fresh_produce",
        "honey": "packaged_food",
        "oat": "packaged_food",
        "grain": "packaged_food",
        "seed": "packaged_food",
        "oil": "packaged_food",
        "snack": "packaged_food",
        "tea": "packaged_food",
        "coffee": "packaged_food",
        "grocery": "packaged_food",
        "food": "packaged_food",
        "staple": "packaged_food",
    }
    for kw, p_group in keyword_map.items():
        if kw in clean:
            return p_group

    return "default"


def get_attribute_schema_for_category(category_slug: Optional[str]) -> List[Dict[str, Any]]:
    """Returns the attribute schema for the given category."""
    if not category_slug:
        return []
    clean = category_slug.lower().strip()
    # Check direct match
    if clean in CATEGORY_ATTRIBUTE_SCHEMAS:
        return CATEGORY_ATTRIBUTE_SCHEMAS[clean]
    
    # Check if child of a top category
    cat = get_category_by_slug(clean)
    if cat and cat.get("parent_id"):
        for parent in CATEGORY_TREE:
            if parent["id"] == cat["parent_id"]:
                parent_slug = parent["slug"]
                if parent_slug in CATEGORY_ATTRIBUTE_SCHEMAS:
                    return CATEGORY_ATTRIBUTE_SCHEMAS[parent_slug]

    # Keyword fallback
    if any(k in clean for k in ["laptop", "ultrabook", "notebook", "workstation"]):
        return CATEGORY_ATTRIBUTE_SCHEMAS["laptops"]
    if any(k in clean for k in ["cloth", "fashion", "apparel", "dress", "jean", "shirt"]):
        return CATEGORY_ATTRIBUTE_SCHEMAS["clothing"]
    if any(k in clean for k in ["innerwear", "underwear", "boxer", "bra", "vest"]):
        return CATEGORY_ATTRIBUTE_SCHEMAS["innerwear"]
    if any(k in clean for k in ["elec", "audio", "headphone", "gadget", "watch"]):
        return CATEGORY_ATTRIBUTE_SCHEMAS["electronics"]
    if any(k in clean for k in ["kitchen", "cookware", "appliance"]):
        return CATEGORY_ATTRIBUTE_SCHEMAS["home_kitchen"]
    if any(k in clean for k in ["personal", "skin", "hair", "grooming"]):
        return CATEGORY_ATTRIBUTE_SCHEMAS["personal_care"]
    if "luxury" in clean:
        return CATEGORY_ATTRIBUTE_SCHEMAS["luxury"]
    if any(k in clean for k in ["food", "groc", "honey", "oat", "oil", "produce", "fruit", "veg"]):
        return CATEGORY_ATTRIBUTE_SCHEMAS["grocery"]

    return []
