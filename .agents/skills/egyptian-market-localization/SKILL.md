---
name: egyptian-market-localization
description: Egyptian market-specific validation and localization patterns. Triggers when working on phone validation, Arabic/English bilingual content, governorate/city data, EGP currency, or Egyptian cultural UX considerations.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Egyptian Market Localization — FashionConnect

## Why Egyptian Market Is Different

Egypt has specific requirements that differ from global e-commerce:

- **Bilingual by default**: Arabic (primary) + English (secondary)
- **Phone format**: +20 (country code) with carrier-specific prefixes
- **Payment culture**: COD dominates (~70% of transactions)
- **Governorate structure**: 27 governorates with city-level delivery zones
- **Currency**: Egyptian Pound (ج.م / EGP)
- **Trust signals**: Verification badges and reviews are critical
- **Business hours**: Friday is weekend, Saturday varies

---

## Egyptian Phone Number Patterns

```typescript
// Valid formats:
// +201012345678 (Vodafone)
// +201112345678 (Etisalat)
// +201212345678 (Orange)
// +201512345678 (WE)
// 01012345678   (local format)

// Carrier detection by prefix:
const CARRIERS = {
  '10': 'vodafone',
  '11': 'etisalat',
  '12': 'orange',
  '15': 'we',
  '02': 'landline'
};

// Normalization rule:
// ALWAYS store in international format: +20xxxxxxxxxx
// NEVER trust client-provided format without validation
```

### Phone Validation Decorator

```typescript
@IsEgyptianPhone()
phone: string;

// Implementation checks:
// 1. Remove non-digits
// 2. Validate length (12 digits with +20, or 11 with 0)
// 3. Check carrier prefix is valid
// 4. Normalize to +20xxxxxxxxxx format
```

---

## Governorate & City Data Structure

```typescript
// Prisma Schema Pattern
model Governorate {
  id     String  @id @default(uuid())
  nameAr String  // "القاهرة"
  nameEn String  // "Cairo"
  code   String  @unique // "CAI"
  cities City[]
}

model City {
  id            String      @id
  governorateId String
  governorate   Governorate @relation(...)
  nameAr        String      // "مدينة نصر"
  nameEn        String      // "Nasr City"
}

// Top 5 Governorates by population:
// 1. Cairo (CAI)
// 2. Giza (GIZ)
// 3. Alexandria (ALX)
// 4. Qalyubia (QAL)
// 5. Sharqia (SHR)
```

### Address Validation Rules

- User selects from **dropdown** (governorate → city), NOT free text
- Delivery fees calculated based on **governorate zones**
- Store `cityId` reference, not city name string
- Validate `cityId` belongs to selected `governorateId`

---

## Bilingual Content Rules

```typescript
// ALWAYS require both languages for user-facing content
export class CreateProductDto {
  @IsString()
  @Matches(/[\u0600-\u06FF]/, { message: 'Must contain Arabic characters' })
  nameAr: string;

  @IsString()
  @Matches(/[a-zA-Z]/, { message: 'Must contain English characters' })
  nameEn: string;

  @IsString()
  descriptionAr: string;

  @IsString()
  descriptionEn: string;
}

// API Response Pattern:
// Return BOTH languages, let client choose
{
  "id": "123",
  "nameAr": "فستان صيفي",
  "nameEn": "Summer Dress",
  "name": "فستان صيفي" // Localized based on Accept-Language header
}
```

### Language Detection

```typescript
// Detect primary language from text
const hasArabic = /[\u0600-\u06FF]/.test(text);
const hasEnglish = /[a-zA-Z]/.test(text);

// For API responses:
const language = req.headers['accept-language']?.startsWith('ar') ? 'ar' : 'en';
```

---

## Currency Handling (Egyptian Pound)

```typescript
// Display formats:
// Arabic: "ج.م 1,234.56"
// English: "EGP 1,234.56"

// ALWAYS store in piasters (integer) to avoid floating-point errors
const egpToPiasters = (egp: number) => Math.round(egp * 100);
const piastersToEgp = (piasters: number) => piasters / 100;

// Example:
// User sees: "ج.م 399.99"
// Database stores: 39999 (piasters as integer)

// Format for display:
const formatEGP = (amount: number, lang: 'ar' | 'en') => {
  return lang === 'ar'
    ? `ج.م ${amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}`
    : `EGP ${amount.toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
};
```

---

## Date & Time (Cairo Timezone)

```typescript
// Egypt timezone: Africa/Cairo (UTC+2, no DST since 2016)

// ALWAYS use date-fns-tz for Cairo time
import { toZonedTime, format } from 'date-fns-tz';
import { ar } from 'date-fns/locale';

const CAIRO_TZ = 'Africa/Cairo';

const nowInCairo = () => toZonedTime(new Date(), CAIRO_TZ);

// Format for Arabic users:
const formatArabic = (date: Date) => 
  format(toZonedTime(date, CAIRO_TZ), 'dd/MM/yyyy hh:mm a', { 
    timeZone: CAIRO_TZ, 
    locale: ar 
  });

// Business hours check (9 AM - 6 PM, excluding Friday)
const isBusinessHours = (date: Date) => {
  const cairoDate = toZonedTime(date, CAIRO_TZ);
  const hour = cairoDate.getHours();
  const day = cairoDate.getDay();
  
  return day !== 5 && hour >= 9 && hour < 18; // Friday = 5
};
```

---

## Trust Signals for Egyptian Market

```typescript
// Brand trust score calculation (weighted for Egypt)
const calculateTrustScore = (brand) => {
  let score = 0;
  
  // Verification status (30 points)
  if (brand.verificationStatus === 'trusted_verified') score += 30;
  else if (brand.verificationStatus === 'basic_verified') score += 15;
  
  // COD success rate (25 points) - CRITICAL for Egypt
  score += brand.codSuccessRate * 0.25;
  
  // Reviews & rating (20 points)
  score += (brand.rating / 5) * 20;
  
  // Total orders (15 points) - social proof
  score += Math.min(brand.totalOrders / 100, 1) * 15;
  
  // Response time (10 points)
  score += brand.responseTime < 30 ? 10 : 5;
  
  return Math.round(Math.min(score, 100));
};
```

### Display Trust Badges

- **Commercial Registry**: Required for trusted verification
- **Tax Card**: Shows business legitimacy
- **Verified Phone**: SMS verification completed
- **COD Reliability**: >90% success rate badge
- **Fast Response**: <30 min average response time

---

## Validation Messages (Bilingual)

```typescript
// Custom validation pipe with Arabic/English errors
export class BilingualValidationPipe extends ValidationPipe {
  constructor() {
    super({
      exceptionFactory: (errors) => {
        const language = 'ar'; // Get from request context
        return new BadRequestException({
          success: false,
          message: language === 'ar' 
            ? 'خطأ في التحقق من البيانات' 
            : 'Validation failed',
          errors: this.formatErrors(errors, language),
        });
      },
    });
  }
}

// DTO validation messages must include both languages:
@MinLength(3, { 
  message: 'اسم المنتج يجب أن يكون 3 أحرف على الأقل | Product name must be at least 3 characters'
})
nameAr: string;
```

---

## What NOT To Do

- NEVER store phone numbers without normalization to +20 format
- NEVER use free-text for governorate/city (use structured dropdown)
- NEVER store prices in floats (use integer piasters)
- NEVER assume English-only content
- NEVER ignore Arabic character validation
- NEVER mix Arabic/English numerals in display (keep consistent)
- NEVER skip timezone conversion (always use Africa/Cairo)
- NEVER display prices without ج.م or EGP symbol
- NEVER forget Friday is weekend in Egypt

---

## Egyptian Market Checklist

- [ ] Phone numbers normalized to +20xxxxxxxxxx
- [ ] Both Arabic and English content required
- [ ] Governorate/city structured data (not free text)
- [ ] Prices stored in piasters (integer)
- [ ] Currency displayed with ج.م (Arabic) or EGP (English)
- [ ] Dates/times in Africa/Cairo timezone
- [ ] COD prominently featured as payment option
- [ ] Trust badges visible on brand profiles
- [ ] Validation errors in both Arabic and English
- [ ] Business hours respect Friday weekend
