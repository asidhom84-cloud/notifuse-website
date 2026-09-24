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
  '{n} students registered': '{n} طالب مسجل',
  '1 student': 'طالب واحد',
  '{n} other students': '{n} طلاب آخرون',
  'Sharing with other parents': 'المشاركة مع أولياء الأمور الآخرين',
  'Nothing is shared unless you tick a box. Only first names are shown, in the area list. Your phone number, pickup location and address are never shown to other parents.':
    'لا تتم مشاركة أي شيء إلا إذا اخترت ذلك. تظهر الأسماء الأولى فقط في قائمة المناطق. رقم هاتفك ومكان الركوب وعنوانك لا تظهر أبدًا لأولياء الأمور الآخرين.',
  'Allow my first name to appear in the shared area list.': 'أسمح بظهور اسمي الأول في قائمة المنطقة المشتركة.',
  "Allow my children's first names to appear to other registered parents.": 'أسمح بظهور الأسماء الأولى لأبنائي لأولياء الأمور المسجلين الآخرين.',
  'My transportation status': 'حالة النقل الخاصة بي',
  'Area': 'المنطقة',
  'Students in your area': 'الطلاب في منطقتك',
  '{n} students are currently registered in your area.': '{n} طالب مسجلون حاليًا في منطقتك.',
  'Near your pickup point': 'بالقرب من مكان ركوبك',
  '{n} other students are registered within about 1 km of your pickup point.': '{n} طالب آخرون مسجلون على بعد حوالي 1 كم من مكان ركوبك.',
  'More registrations may be added in your area.': 'قد تتم إضافة تسجيلات أخرى في منطقتك.',
  'Bus assignment': 'تحديد الباص',
  'Not assigned yet': 'لم يتم التحديد بعد',
  'Bus assignments are still being prepared.': 'جارٍ إعداد توزيع الباصات.',
  // Same-bus sharing (final model)
  'Sharing with your bus group': 'المشاركة مع مجموعة الباص',
  'Who can see this?': 'من يمكنه رؤية ذلك؟',
  'Only families assigned to the same bus as you, once buses are assigned.': 'الأسر المسجلة على نفس الباص معك فقط، بعد توزيع الباصات.',
  "Parents assigned to other buses cannot see your pickup point, name, children's names or phone number.": 'أولياء الأمور على الباصات الأخرى لا يمكنهم رؤية مكان ركوبك أو اسمك أو أسماء أبنائك أو رقم هاتفك.',
  "Allow my pickup point to appear on my bus's shared route": 'أسمح بظهور مكان ركوبي على خط سير الباص المشترك',
  'Show my first name to parents on my bus': 'إظهار اسمي الأول لأولياء الأمور على نفس الباص',
  "Show my children's first names to parents on my bus": 'إظهار الأسماء الأولى لأبنائي لأولياء الأمور على نفس الباص',
  'Show my phone number to parents on my bus': 'إظهار رقم هاتفي لأولياء الأمور على نفس الباص',
  'Your pickup location is always visible to the administrator for route planning, even if you choose not to share it with other parents. The bus driver and supervisor receive the details needed to run the bus.':
    'مكان ركوبك يظهر دائمًا للمسؤول لتخطيط خط السير، حتى لو اخترت عدم مشاركته مع أولياء الأمور الآخرين. سائق الباص والمشرف يحصلان على البيانات اللازمة لتشغيل الباص.',
  // Home / demand map
  'My bus & status': 'باصي وحالتي',
  'Where students are registered': 'أماكن تسجيل الطلاب',
  'Anonymous groups of 3 or more families. No names or exact locations are shown.': 'مجموعات مجهولة الهوية من 3 أسر أو أكثر. لا تظهر أسماء أو أماكن دقيقة.',
  '{n} students near this area': '{n} طالب بالقرب من هذه المنطقة',
  'Only totals are shown here. Names, phone numbers, addresses and pickup locations are never shown school-wide. After buses are assigned, families on the same bus can see their bus route and whatever each family chose to share.':
    'تظهر هنا الأعداد فقط. الأسماء وأرقام الهواتف والعناوين وأماكن الركوب لا تظهر أبدًا على مستوى المدرسة. بعد توزيع الباصات، ترى الأسر على نفس الباص خط سير الباص وما اختارت كل أسرة مشاركته.',
  // PIN / sessions
  'This phone will remember your bus details for 30 days (view only). Use “Sign out of this device” on a shared phone.': 'سيتذكر هذا الهاتف بيانات باصك لمدة 30 يومًا (للعرض فقط). استخدم «تسجيل الخروج من هذا الجهاز» إذا كان الهاتف مشتركًا.',
  'Sign out of this device': 'تسجيل الخروج من هذا الجهاز',
  'Remove your registration details from this phone? You will need your Registration ID and PIN again.': 'هل تريد إزالة بيانات تسجيلك من هذا الهاتف؟ ستحتاج إلى رقم التسجيل والرقم السري مرة أخرى.',
  'Signed out of this device': 'تم تسجيل الخروج من هذا الجهاز',
  // Status
  'New: sharing with your bus group': 'جديد: المشاركة مع مجموعة الباص',
  "You can now choose whether families on your bus can see your pickup point, first name, children's first names or phone. Nothing is shared until you choose.":
    'يمكنك الآن اختيار ما إذا كانت الأسر على باصك ترى مكان ركوبك أو اسمك الأول أو الأسماء الأولى لأبنائك أو رقم هاتفك. لا تتم مشاركة أي شيء حتى تختار.',
  'Review sharing options': 'مراجعة خيارات المشاركة',
  '{n} students assigned': '{n} طالب على الباص',
  'Capacity {n}': 'السعة {n}',
  '{n} seats available': '{n} مقعد متاح',
  'Route': 'خط السير',
  'Being prepared': 'جارٍ الإعداد',
  'Being added to the route': 'جارٍ إضافتك إلى خط السير',
  'Your family has been placed on this bus. Your stop will be added when the route is next updated.': 'تم وضع أسرتك على هذا الباص. ستتم إضافة محطتك عند التحديث القادم لخط السير.',
  'You have been placed on bus {bus}, near other registered families. The school may still adjust bus assignments.': 'تم وضعك على الباص {bus} بالقرب من أسر مسجلة أخرى. قد تقوم المدرسة بتعديل توزيع الباصات لاحقًا.',
  'Needs review': 'بحاجة إلى مراجعة',
  'Your pickup point changed after bus assignment. The administrator will update your bus or route.': 'تغيّر مكان ركوبك بعد توزيع الباصات. سيقوم المسؤول بتحديث الباص أو خط السير.',
  'Approved': 'معتمد',
  'Your stop: {n} of {total}': 'محطتك: {n} من {total}',
  'Estimated pickup {time}': 'موعد الركوب التقريبي {time}',
  'View my bus route': 'عرض خط سير باصي',
  // My bus route
  'My bus route': 'خط سير باصي',
  'Your bus route is being prepared.': 'جارٍ إعداد خط سير باصك.',
  'Morning route': 'خط سير الصباح',
  '{n} stops': '{n} محطة',
  'Stop {n}': 'محطة {n}',
  'YOU': 'أنت',
  'Start': 'البداية',
  'Stops': 'المحطات',
  'Only families assigned to this bus can see this route. Grey stops are approximate because those families keep their exact pickup point private.':
    'الأسر المسجلة على هذا الباص فقط يمكنها رؤية خط السير هذا. المحطات الرمادية تقريبية لأن هذه الأسر تحتفظ بمكان ركوبها الدقيق بشكل خاص.',
  'Approximate position — this family keeps its exact pickup point private.': 'مكان تقريبي — هذه الأسرة تحتفظ بمكان ركوبها الدقيق بشكل خاص.',
  'Families on your bus who chose to share': 'أسر على باصك اختارت المشاركة',
  'Register my family': 'تسجيل أسرتي',
  'Edit my registration': 'تعديل تسجيلي',
  'Only totals are shown here, plus first names of families who chose to share them. Phone numbers, addresses and pickup locations are never visible to other parents.':
    'تظهر هنا الأعداد فقط، مع الأسماء الأولى للأسر التي اختارت مشاركتها. أرقام الهواتف والعناوين وأماكن الركوب لا تظهر أبدًا لأولياء الأمور الآخرين.',

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
