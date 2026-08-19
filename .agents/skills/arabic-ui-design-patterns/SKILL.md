---
name: arabic-ui-design-patterns
description: Arabic-first RTL UI design patterns for bilingual e-commerce interfaces. Triggers when designing user interfaces, creating components, or implementing responsive/mobile layouts.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Arabic UI Design Patterns — FashionConnect

## Why Arabic UI Is Different

Designing for Arabic-speaking users requires fundamental layout changes, not just translation:

- **Right-to-left flow** affects the entire interface layout and navigation
- **Longer text** in Arabic means different spacing, wrapping, and component sizing
- **Cultural expectations** around trust signals, colors, and social proof
- **Mobile-first** — 95% of Egyptian users access via mobile
- **Local patterns**: COD emphasis, phone-first input, trust badges prominent

---

## RTL Layout Fundamentals

### Direction-Aware CSS

```css
/* NEVER hardcode left/right positioning */
/* WRONG: */
.button { margin-left: 10px; }
.sidebar { float: left; }

/* CORRECT: Use logical properties */
.button { margin-inline-start: 10px; }
.sidebar { float: inline-start; }

/* Or use CSS logical properties */
.text-content {
  direction: rtl;        /* For Arabic */
  text-align: start;     /* Auto-aligns based on direction */
}
```

### Next.js i18n Setup

```typescript
// next.config.js
module.exports = {
  i18n: {
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    localeDetection: true,
  },
};

// Component pattern:
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

export default function ProductCard() {
  const t = useTranslations('Product');
  const { locale } = useRouter();
  
  return (
    <div className={`${locale === 'ar' ? 'text-right' : 'text-left'}`}>
      <h2 className="text-2xl font-bold">{t('title')}</h2>
    </div>
  );
}
```

---

## Layout Mirroring

### Navigation Pattern

```
English (LTR)          Arabic (RTL)
┌─────────────────┐    ┌─────────────────┐
│ ☰ Home           │    │   Home         ☰ │
│ 🔍 Search          │    │   Search       🔍 │
│ 🛒 Cart            │    │   Cart         🛒 │
│ 👤 Profile         │    │   Profile      👤 │
└─────────────────┘    └─────────────────┘
```

### Form Layout

```css
/* Use flexbox with direction awareness */
.form-row {
  display: flex;
  gap: 1rem;
}

/* Auto-mirrors for RTL */
[dir="rtl"] .form-row {
  flex-direction: row-reverse;
}

/* Tailwind RTL-aware: */
<input className="pr-4 pl-2" /> /* Auto-reverses in RTL */
```

---

## Egyptian Mobile Patterns

### Responsive Strategy
- **Primary**: 375px-414px width (iPhone-like phones dominate)
- **Secondary**: 768px+ (tablets, desktop for admin)
- **Typography**: Slightly larger for readability (16px minimum inputs)

### Touch Targets

```css
/* Minimum 44px touch target */
.touch-button {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;
}

/* Increased spacing for larger fingers */
.form-input {
  padding: 14px 16px;
  font-size: 16px;        /* Prevents iOS zoom on focus */
  min-height: 48px;
}
```

---

## Currency & Number Formatting

### Price Display

```typescript
import { currency } from 'next-intl';

function PriceDisplay({ amount }: { amount: number }) {
  const { locale } = useRouter();
  
  return (
    <span>
      {locale === 'ar' 
        ? `ج.م ${amount.toLocaleString('ar-EG')}`
        : `EGP ${amount.toLocaleString('en-EG')}`
      }
    </span>
  );
}

// Examples:
// Arabic: "ج.م ١٬٢٣٤٫٥٦"
// English: "EGP 1,234.56"
```

### Number Localization

```typescript
const formatQuantity = (qty: number) => {
  const { locale } = useRouter();
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG').format(qty);
}

// Arabic: ١٬٢٣٤
// English: 1,234
```

---

## Cultural UI Considerations

### Trust Signals (Critical for Egypt)

```typescript
// Trust badges positioned on trailing edge for both languages
<div className="badge-container">
  <span className="badge badge-success">
    {locale === 'ar' ? 'موثوق' : 'Verified'}
  </span>
</div>

// COD badge with high prominence
<span className={`cod-badge ${locale === 'ar' ? 'badge-ar' : 'badge-en'}`}>
  {locale === 'ar' ? 'دفع عند الاستلام' : 'Cash on Delivery'}
</span>
```

### Payment Method Order

```typescript
// COD should ALWAYS be first option in Egypt
const paymentMethods = locale === 'ar' 
  ? [
      { id: 'cod', name: 'دفع عند الاستلام' },
      { id: 'card', name: 'بطاقة ائتمان' },
      { id: 'wallet', name: 'محفظة إلكترونية' }
    ]
  : [
      { id: 'cod', name: 'Cash on Delivery' },
      { id: 'card', name: 'Credit Card' },
      { id: 'wallet', name: 'Digital Wallet' }
    ];
```

---

## Typography & Readability

### Font Selection

```css
/* Import Egyptian-friendly Arabic font */
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');

.font-arabic {
  font-family: 'Cairo', system-ui, sans-serif;
}

/* Arabic needs more line height */
.text-arabic {
  line-height: 1.7;        /* vs 1.5 for English */
  letter-spacing: 0.02em;   /* Slight tracking for readability */
}
```

### Text Direction Utility

```typescript
// Reusable utility
const getTextDirection = (locale: string) => 
  locale === 'ar' ? 'rtl' : 'ltr';

// Use in every component:
<div dir={getTextDirection(locale)}>
  {content}
</div>
```

---

## Component Patterns

### Dropdown Menus

```typescript
// RTL-aware positioning
const getDropdownPosition = (locale: string) => 
  locale === 'ar' ? 'top-right' : 'top-left';

// CSS approach with logical properties:
.dropdown-menu {
  position: absolute;
  inset-inline-start: 0;  /* Left in LTR, Right in RTL */
  top: 100%;
}
```

### Pagination

```typescript
// Arabic: ← السابق | التالي →
// English: ← Previous | Next →

<Pagination direction={locale === 'ar' ? 'rtl' : 'ltr'}>
  <Pagination.Prev>
    {locale === 'ar' ? 'السابق' : 'Previous'}
  </Pagination.Prev>
  <Pagination.Next>
    {locale === 'ar' ? 'التالي' : 'Next'}
  </Pagination.Next>
</Pagination>
```

### Forms with Right-Aligned Labels

```typescript
// Forms adapt to text direction
<form className={`form ${locale === 'ar' ? 'form-rtl' : 'form-ltr'}`}>
  <label>
    {locale === 'ar' ? 'الاسم' : 'Name'}
  </label>
  <input 
    className={locale === 'ar' ? 'text-right' : 'text-left'}
    type="text"
  />
</form>
```

---

## Icons & Visual Elements

### Mirroring Directional Icons

```typescript
const DirectionalIcon = ({ icon, locale }) => {
  const shouldMirror = ['arrow-left', 'chevron-left', 'back'].includes(icon) 
    && locale === 'ar';
  
  return (
    <Icon 
      name={icon}
      className={shouldMirror ? 'scale-x-[-1]' : ''}
    />
  );
};

// Usage:
<DirectionalIcon icon="arrow-left" locale={locale} />
// → Displays arrow-right icon automatically in Arabic
```

---

## Arabic-First Design Checklist

- [ ] All layouts use CSS logical properties (`margin-inline-start`, not `margin-left`)
- [ ] Text direction set via `dir="rtl"` for Arabic content
- [ ] Currency displays with **ج.م** for Arabic, **EGP** for English
- [ ] Numbers display in Arabic numerals (١٢٣٤) when locale is ar
- [ ] Form inputs have appropriate text alignment (right for Arabic)
- [ ] Navigation mirrors correctly (left sidebar becomes right sidebar)
- [ ] Trust badges positioned on trailing edge for both languages
- [ ] COD badge is most prominent, first in payment options
- [ ] Touch targets minimum 44px × 44px for mobile
- [ ] Font size minimum 16px to prevent iOS zoom on form inputs
- [ ] Line height increased for Arabic text (1.6-1.7)
- [ ] Directional icons (arrows, chevrons) mirrored in RTL
- [ ] All UI strings are bilingual (Arabic + English)
- [ ] Phone input shows Arabic placeholder (+٢٠ ١٠٠ ١٢٣ ٤٥٦٧)
- [ ] Empty states and error messages are bilingual

---

## Common Pitfalls

### ❌ WRONG APPROACHES
- Hardcoding `float: left` or `margin-left`
- Using `:after` pseudo-elements with fixed directions
- Ignoring text expansion (Arabic text ~30% longer than English)
- Placing navigation elements assuming LTR flow
- Using fixed pixel widths that break in RTL

### ✅ BEST PRACTICES
- Always use CSS logical properties for positioning
- Test layouts with both languages at 320px width
- Use `dir="auto"` for mixed-language content
- Implement i18n from day one, not as an afterthought
- Mirror directional icons and illustrations
- Use flexbox/grid with logical directions
- Test on actual Egyptian mobile devices

---

## Testing RTL Layouts

```typescript
// Cypress e2e test example
describe('RTL Layout Tests', () => {
  beforeEach(() => {
    cy.visit('/', { qs: { lang: 'ar' } });
  });

  it('mirrors navigation correctly', () => {
    cy.get('[data-testid="nav-drawer"]')
      .should('have.attr', 'dir', 'rtl');
  });

  it('displays prices in Arabic format', () => {
    cy.get('[data-testid="price"]')
      .should('contain', 'ج.م');
  });

  it('aligns text to the right', () => {
    cy.get('[data-testid="product-card"]')
      .should('have.css', 'text-align', 'right');
  });
});
```

---

## Performance Considerations

```css
/* Font loading optimization */
@font-face {
  font-family: 'Cairo';
  src: url('/fonts/cairo-ar.woff2') format('woff2');
  unicode-range: U+0600-06FF;  /* Arabic block only */
}

html[lang="ar"] {
  font-display: swap;
}
```

---

## Related Skills
- egyptian-market-localization
- nextjs-bff-communication
- api-contract-standards

## References
- [CSS Logical Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_editing)
- [W3C Internationalization - Arabic](https://www.w3.org/International/questions/qa-html-dir)
- [RTL CSS Techniques](https://rtl-css.io/)