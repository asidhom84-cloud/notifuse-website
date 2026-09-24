// SJAS Bus Registration — English / Arabic strings. Keys are the English text,
// so t('Text') returns it unchanged in English. The admin page stays English.

const AR = {
  // Shell / gate
  'SJAS Bus Registration': 'تسجيل باص SJAS',
  'School bus registration and pickup location': 'تسجيل الباص المدرسي ومكان الركوب',
  'Powered by NotiFamily': 'بدعم من NotiFamily',
  'Enter the access password shared with parents.': 'أدخل كلمة المرور المرسلة لأولياء الأمور.',
  'Access password': 'كلمة المرور',
  'Enter': 'دخول',
  'Sign out': 'تسجيل الخروج',
  'Your session has ended. Please enter the password again.': 'انتهت الجلسة. من فضلك أدخل كلمة المرور مرة أخرى.',
  'Switching language will clear what you typed. Continue?': 'تغيير اللغة سيمسح ما كتبته. هل تريد المتابعة؟',
  'Loading…': 'جارٍ التحميل…',
  'Try again': 'حاول مرة أخرى',

  // Home
  'Families registered': 'الأسر المسجلة',
  'Students registered': 'الطلاب المسجلون',
  'Students by area': 'الطلاب حسب المنطقة',
  'Other areas': 'مناطق أخرى',
  '{n} students': '{n} طالب',
  'No registrations yet — be the first.': 'لا توجد تسجيلات بعد — كن أول من يسجل.',
  'Register my family': 'تسجيل أسرتي',
  'Edit my registration': 'تعديل تسجيلي',
  'Only anonymous totals are shown here. Names, phone numbers and pickup locations are never visible to other parents.':
    'تظهر هنا الأعداد فقط بدون أي بيانات شخصية. الأسماء وأرقام الهواتف وأماكن الركوب لا تظهر أبدًا لأولياء الأمور الآخرين.',

  // Form
  '← Back': '→ رجوع',
  'Register my family': 'تسجيل أسرتي',
  'Your details are seen only by the transportation administrators.': 'بياناتك يراها مسؤولو النقل فقط.',
  'Parent full name': 'اسم ولي الأمر بالكامل',
  'Phone number': 'رقم الهاتف',
  'Students': 'الطلاب',
  'Student {n} full name': 'اسم الطالب {n} بالكامل',
  'Grade / class': 'الصف / الفصل',
  '(optional)': '(اختياري)',
  'Remove student {n}': 'حذف الطالب {n}',
  '+ Add student': '+ إضافة طالب',
  'Number of students: {n}': 'عدد الطلاب: {n}',
  'Area / district': 'المنطقة / الحي',
  'Choose your area': 'اختر منطقتك',
  '+ My area is not listed': '+ منطقتي غير موجودة',
  'Type your area': 'اكتب اسم منطقتك',
  'Back to the list': 'العودة للقائمة',
  'Did you mean {area}?': 'هل تقصد {area}؟',
  'Pickup location': 'مكان الركوب',
  'Required. Choose where the bus should pick up your children.': 'مطلوب. اختر المكان الذي يأخذ منه الباص أبناءك.',
  '📍 Use my current location': '📍 استخدام موقعي الحالي',
  '🗺 Choose location on map': '🗺 اختيار المكان على الخريطة',
  '✅ Pickup location selected': '✅ تم اختيار مكان الركوب',
  'Adjust pin': 'تعديل الدبوس',
  'From your phone location (±{m} m)': 'من موقع هاتفك (±{m} م)',
  'Chosen on the map': 'تم اختياره على الخريطة',
  'Found by search': 'تم إيجاده بالبحث',
  'Optional address details': 'تفاصيل العنوان (اختياري)',
  'Building / villa / compound': 'العمارة / الفيلا / الكمبوند',
  'Street': 'الشارع',
  'Landmark': 'علامة مميزة',
  'Pickup notes': 'ملاحظات للركوب',
  'e.g. Building 12, gate 2': 'مثال: عمارة 12، البوابة 2',
  'e.g. near the mosque': 'مثال: بجوار المسجد',
  'e.g. please call when you arrive': 'مثال: من فضلك اتصل عند الوصول',
  'Maps are provided by OpenStreetMap. Their servers see which part of the map is shown or searched — never your name, phone or children.':
    'الخرائط مقدمة من OpenStreetMap. خوادمهم ترى جزء الخريطة المعروض أو الذي تبحث عنه فقط — ولا ترى اسمك أو رقمك أو أبناءك أبدًا.',
  'I agree that my contact details, student information and selected pickup location may be used by the transportation administrators for school bus planning.':
    'أوافق على أن بيانات التواصل الخاصة بي وبيانات الطلاب ومكان الركوب الذي اخترته يمكن أن يستخدمها مسؤولو النقل لتخطيط الباص المدرسي.',
  'Submit registration': 'إرسال التسجيل',
  'Save changes': 'حفظ التعديلات',
  'Cancel': 'إلغاء',
  'Saving…': 'جارٍ الحفظ…',
  'Please enter the parent full name.': 'من فضلك أدخل اسم ولي الأمر بالكامل.',
  'Please enter a valid phone number.': 'من فضلك أدخل رقم هاتف صحيح.',
  'Please enter at least one student name.': 'من فضلك أدخل اسم طالب واحد على الأقل.',
  'Please choose your area.': 'من فضلك اختر منطقتك.',
  'Please choose the pickup location.': 'من فضلك اختر مكان الركوب.',
  'Please tick the consent box to continue.': 'من فضلك وافق على الشروط للمتابعة.',
  'This location appears far from the expected service area. Please confirm the pin.': 'يبدو أن هذا المكان بعيد عن منطقة الخدمة المتوقعة. من فضلك تأكد من الدبوس.',
  'Something went wrong. Please try again.': 'حدث خطأ. من فضلك حاول مرة أخرى.',

  // Picker
  'Choose pickup point': 'اختر مكان الركوب',
  'Close': 'إغلاق',
  'Search a place, compound or street': 'ابحث عن مكان أو كمبوند أو شارع',
  'Search': 'بحث',
  'Searching…': 'جارٍ البحث…',
  'No places found. Try another name, or move the map and tap the spot.': 'لم يتم العثور على أماكن. جرّب اسمًا آخر، أو حرّك الخريطة واضغط على المكان.',
  'Search is unavailable right now. Move the map and tap the spot instead.': 'البحث غير متاح الآن. حرّك الخريطة واضغط على المكان بدلًا من ذلك.',
  'Tap the map to place the pin, then drag it to the exact spot.': 'اضغط على الخريطة لوضع الدبوس، ثم اسحبه للمكان الصحيح.',
  'Please make sure the pin is on your preferred bus pickup point.': 'من فضلك تأكد أن الدبوس على مكان الركوب المفضل لديك.',
  'If you are not currently at the pickup location, move the pin to the correct place.': 'إذا لم تكن في مكان الركوب الآن، حرّك الدبوس إلى المكان الصحيح.',
  'Getting your location…': 'جارٍ تحديد موقعك…',
  'Location found (±{m} m). Drag the pin if needed.': 'تم تحديد الموقع (±{m} م). اسحب الدبوس إذا لزم الأمر.',
  'Location is approximate (±{m} m). Please move the pin to the exact pickup point.': 'الموقع تقريبي (±{m} م). من فضلك حرّك الدبوس إلى مكان الركوب بالضبط.',
  'Location permission was not allowed. No problem — tap the map to choose the pickup point.': 'لم يتم السماح بالوصول للموقع. لا مشكلة — اضغط على الخريطة لاختيار مكان الركوب.',
  'Your location could not be found. Tap the map to choose the pickup point instead.': 'تعذر تحديد موقعك. اضغط على الخريطة لاختيار مكان الركوب بدلًا من ذلك.',
  'Tip: inside WhatsApp, location may be blocked. You can also open this page in Safari or Chrome.': 'نصيحة: داخل واتساب قد يكون الموقع محظورًا. يمكنك أيضًا فتح الصفحة في Safari أو Chrome.',
  '📍 My location': '📍 موقعي',
  'Confirm pickup point': 'تأكيد مكان الركوب',
  'The map could not be loaded. Please check your connection and try again.': 'تعذر تحميل الخريطة. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.',

  // Saved
  'Registration saved successfully': 'تم حفظ التسجيل بنجاح',
  'Registration ID': 'رقم التسجيل',
  'Private Edit PIN': 'الرقم السري للتعديل',
  'Keep these details safe if you need to update your registration later. The PIN will not be shown again.':
    'احتفظ بهذه البيانات إذا احتجت لتعديل تسجيلك لاحقًا. لن يظهر الرقم السري مرة أخرى.',
  'Copy details': 'نسخ البيانات',
  'Send to myself on WhatsApp': 'إرسالها لنفسي على واتساب',
  'Done': 'تم',
  'Copied': 'تم النسخ',
  'Could not copy — please write them down': 'تعذر النسخ — من فضلك اكتبها عندك',
  'SJAS Bus Registration\nRegistration ID: {id}\nEdit PIN: {pin}\n{url}': 'تسجيل باص SJAS\nرقم التسجيل: {id}\nالرقم السري للتعديل: {pin}\n{url}',

  // Edit
  'Enter the Registration ID and Edit PIN you received when you registered.': 'أدخل رقم التسجيل والرقم السري اللذين ظهرا لك عند التسجيل.',
  'Edit PIN': 'الرقم السري للتعديل',
  '6 digits': '6 أرقام',
  'Continue': 'متابعة',
  'Lost your PIN? Ask the administrator to reset it.': 'نسيت الرقم السري؟ اطلب من المسؤول إعادة تعيينه.',
  'Edit {code}': 'تعديل {code}',
  'Finish editing': 'إنهاء التعديل',
  'Changes saved': 'تم حفظ التعديلات',
  'Your edit session expired. Please enter your Registration ID and PIN again.': 'انتهت جلسة التعديل. من فضلك أدخل رقم التسجيل والرقم السري مرة أخرى.',
  'This registration is currently hidden by the administrator.': 'هذا التسجيل مخفي حاليًا بواسطة المسؤول.',
  'Need this registration removed?': 'تريد حذف هذا التسجيل؟',
  'Parents cannot delete registrations. You can ask the administrator to remove it — for example if you registered twice.':
    'لا يمكن لأولياء الأمور حذف التسجيلات بأنفسهم. يمكنك طلب ذلك من المسؤول — مثلًا إذا سجلت مرتين.',
  'Reason': 'السبب',
  '(optional · administrator only)': '(اختياري · للمسؤول فقط)',
  'Request removal': 'طلب الحذف',
  'Removal requested': 'تم طلب الحذف',
  'You asked the administrator to remove this registration on {date}.': 'طلبت من المسؤول حذف هذا التسجيل بتاريخ {date}.',
  'Cancel my request': 'إلغاء طلبي',
  'Ask the administrator to remove this registration?': 'هل تريد طلب حذف هذا التسجيل من المسؤول؟',
  'Removal request sent to the administrator': 'تم إرسال طلب الحذف إلى المسؤول',
  'Request cancelled': 'تم إلغاء الطلب',

  // Server messages
  'Incorrect password.': 'كلمة المرور غير صحيحة.',
  'Too many attempts. Please wait 15 minutes and try again.': 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.',
  'Too many attempts. Please try again later.': 'محاولات كثيرة. حاول مرة أخرى لاحقًا.',
  'Please sign in again.': 'من فضلك سجّل الدخول مرة أخرى.',
  'Registration ID or PIN is incorrect.': 'رقم التسجيل أو الرقم السري غير صحيح.',
  'Too many wrong PINs for this registration. Please try again in an hour or contact the administrator.': 'تم إدخال رقم سري خاطئ عدة مرات. حاول بعد ساعة أو تواصل مع المسؤول.',
  'Too many registrations from this connection. Please try again later.': 'تسجيلات كثيرة من هذا الاتصال. حاول مرة أخرى لاحقًا.',
  'Please choose the pickup location on the map.': 'من فضلك اختر مكان الركوب على الخريطة.',
  'The pickup location is not valid. Please choose it again on the map.': 'مكان الركوب غير صحيح. من فضلك اختره مرة أخرى على الخريطة.',
  'Could not reach the server. Please check your connection and try again.': 'تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.',
  'Parent full name is required': 'اسم ولي الأمر مطلوب',
  'Phone number is required': 'رقم الهاتف مطلوب',
  'Phone number looks invalid': 'رقم الهاتف غير صحيح',
  'At least one student is required': 'مطلوب اسم طالب واحد على الأقل',
  'Area is required': 'المنطقة مطلوبة',
};

const STORE_KEY = 'busreg.lang';
let lang = 'en';

export const getLang = () => lang;
export const isRtl = () => lang === 'ar';

export function t(key, vars) {
  let s = lang === 'ar' && Object.prototype.hasOwnProperty.call(AR, key) ? AR[key] : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

function apply() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('SJAS Bus Registration');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}

/** Parent page only: saved choice, else the phone's language. */
export function initLang() {
  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch { /* ignore */ }
  lang = saved === 'ar' || saved === 'en' ? saved : (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
  apply();
}

export function setLang(next) {
  lang = next === 'ar' ? 'ar' : 'en';
  try { localStorage.setItem(STORE_KEY, lang); } catch { /* ignore */ }
  apply();
}
