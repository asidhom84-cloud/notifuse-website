// SJAS Bus — English / Arabic strings for the parent-facing pages.
// Keys are the English text, so t('Some text') returns it unchanged in English.
// The admin page never calls initLang() and always stays in English.

const AR = {
  // Shell / gate
  'SJAS Bus': 'SJAS Bus',
  'Payment Reconciliation': 'مطابقة المدفوعات',
  'Payment Reconciliation · by Noti Family': 'مطابقة المدفوعات · من Noti Family',
  'SJAS Bus — Payment Reconciliation': 'SJAS Bus — مطابقة المدفوعات',
  "Payment Reconciliation — a shared record of bus payments submitted by parents. Enter the access password shared in the parents' group.":
    'مطابقة المدفوعات — سجل مشترك لمدفوعات الباص التي أدخلها أولياء الأمور. أدخل كلمة المرور المرسلة في جروب أولياء الأمور.',
  'Access password': 'كلمة المرور',
  'Enter': 'دخول',
  'Sign out': 'تسجيل الخروج',
  'Your session has ended. Please enter the password again.': 'انتهت الجلسة. من فضلك أدخل كلمة المرور مرة أخرى.',
  'Switching language will clear what you typed. Continue?': 'تغيير اللغة سيمسح ما كتبته. هل تريد المتابعة؟',

  // Ledger
  'A shared record of bus payments submitted by parents.': 'سجل مشترك لمدفوعات الباص التي أدخلها أولياء الأمور.',
  'Summary': 'الملخص',
  'Families submitted': 'عدد الأسر المسجلة',
  'Students represented': 'عدد الطلاب',
  'Total documented payments': 'إجمالي المدفوعات الموثقة',
  'Add My Payment': 'أضف مدفوعاتي',
  'Edit my submission': 'تعديل بياناتي',
  'Download Excel': 'تحميل Excel',
  'Views': 'طرق العرض',
  'All records': 'كل السجلات',
  'By bus': 'حسب الباص',
  'By district': 'حسب المنطقة',
  'Amounts are as reported by each parent, with their payment screenshots.': 'المبالغ كما أدخلها كل ولي أمر، مع صور إثبات الدفع.',
  'Updated {date} · Mobile numbers and edit PINs are never shown here.': 'آخر تحديث {date} · أرقام الموبايل والأرقام السرية لا تظهر هنا أبدًا.',
  'Search parent, student, bus or district': 'ابحث باسم ولي الأمر أو الطالب أو الباص أو المنطقة',
  'Search': 'بحث',
  'Sort': 'ترتيب',
  'Order added (SJAS number)': 'ترتيب الإضافة (رقم SJAS)',
  'Parent name A–Z': 'اسم ولي الأمر (أبجديًا)',
  'Bus number': 'رقم الباص',
  'Amount paid (high–low)': 'المبلغ المدفوع (من الأعلى)',
  'Amount paid (low–high)': 'المبلغ المدفوع (من الأقل)',
  'Clear filter': 'إلغاء التصفية',
  'No receipts': 'لا توجد إيصالات',
  'View 1 payment receipt': 'عرض إيصال الدفع',
  'View {n} payment receipts': 'عرض {n} إيصالات دفع',
  'View receipts for {name}': 'عرض إيصالات {name}',
  '{label} total': 'إجمالي {label}',
  'Showing {n} of {all}': 'عرض {n} من {all}',
  'All families': 'كل الأسر',
  'No payments have been submitted yet.': 'لم يتم تسجيل أي مدفوعات بعد.',
  'Be the first — it takes about two minutes.': 'كن أول من يسجل — الأمر يستغرق دقيقتين تقريبًا.',
  'No records match your search.': 'لا توجد نتائج مطابقة لبحثك.',
  'TOTAL — {label}': 'الإجمالي — {label}',
  '{n} of {all} families': '{n} من {all} أسرة',
  'TOTAL DOCUMENTED PAYMENTS — ALL FAMILIES': 'إجمالي المدفوعات الموثقة — كل الأسر',
  'TOTAL DOCUMENTED PAYMENTS': 'إجمالي المدفوعات الموثقة',
  'TOTAL DOCUMENTED': 'الإجمالي الموثق',
  'Parent': 'ولي الأمر',
  'Students': 'الطلاب',
  'Bus': 'الباص',
  'Amount Paid': 'المبلغ المدفوع',
  'Proof': 'الإثبات',
  'No records yet.': 'لا توجد سجلات بعد.',
  'No district': 'بدون منطقة',
  'Tap a bus to see its families.': 'اضغط على الباص لعرض الأسر المسجلة عليه.',
  'Tap a district to see its families.': 'اضغط على المنطقة لعرض الأسر المسجلة فيها.',
  'District': 'المنطقة',
  'District(s)': 'المناطق',
  'Buses': 'الباصات',
  'Families': 'الأسر',
  'Total paid': 'إجمالي المدفوع',
  'Preparing…': 'جارٍ التجهيز…',
  'Loading…': 'جارٍ التحميل…',
  'Try again': 'حاول مرة أخرى',
  'Bus {n}': 'باص {n}',

  // Add / saved
  '← Back to the ledger': '→ العودة إلى السجل',
  'Add my payment': 'إضافة مدفوعاتي',
  'Record what you paid to the bus company, with the payment screenshot(s).': 'سجّل ما دفعته لشركة الباص مع صورة (أو صور) إثبات الدفع.',
  'Your submission has been saved.': 'تم حفظ بياناتك.',
  'It now appears in the shared ledger.': 'تظهر الآن في السجل المشترك.',
  'Submission ID': 'رقم التسجيل',
  'Edit PIN': 'الرقم السري للتعديل',
  'Please save these details now.': 'من فضلك احفظ هذه البيانات الآن.',
  'You need both to edit your information later. The PIN will not be shown again — keep it private.':
    'ستحتاج إلى الرقمين لتعديل بياناتك لاحقًا. لن يظهر الرقم السري مرة أخرى — احتفظ به لنفسك.',
  'Copy details': 'نسخ البيانات',
  'Send to myself on WhatsApp': 'إرسالها لنفسي على واتساب',
  "I've saved them — view ledger": 'حفظتها — عرض السجل',
  'Copied': 'تم النسخ',
  'Could not copy — please write them down': 'تعذر النسخ — من فضلك اكتبها عندك',
  'SJAS Bus payment record\nSubmission ID: {id}\nEdit PIN: {pin}\n{url}': 'تسجيل مدفوعات SJAS Bus\nرقم التسجيل: {id}\nالرقم السري للتعديل: {pin}\n{url}',

  // Edit
  'Enter the Submission ID and Edit PIN you received when you submitted.': 'أدخل رقم التسجيل والرقم السري اللذين ظهرا لك عند التسجيل.',
  '6 digits': '6 أرقام',
  'Continue': 'متابعة',
  'Lost your PIN? Ask the administrator to reset it.': 'نسيت الرقم السري؟ اطلب من المسؤول إعادة تعيينه.',
  'Finish editing': 'إنهاء التعديل',
  'Edit {code}': 'تعديل {code}',
  'This submission is currently hidden from the ledger by the administrator.': 'هذا التسجيل مخفي حاليًا من السجل بواسطة المسؤول.',
  'Your edit session expired. Please enter your Submission ID and PIN again.': 'انتهت جلسة التعديل. من فضلك أدخل رقم التسجيل والرقم السري مرة أخرى.',
  'Changes saved': 'تم حفظ التعديلات',
  'Removal requested': 'تم طلب الحذف',
  'You asked the administrator to remove this submission on {date}. It stays in the ledger until the administrator acts on it.':
    'طلبت من المسؤول حذف هذا التسجيل بتاريخ {date}. سيظل ظاهرًا في السجل حتى يتخذ المسؤول الإجراء.',
  'Cancel my request': 'إلغاء طلبي',
  'Need this record removed?': 'تريد حذف هذا التسجيل؟',
  'Parents cannot delete submissions. You can ask the administrator to withdraw it — for example if it was submitted twice.':
    'لا يمكن لأولياء الأمور حذف التسجيلات بأنفسهم. يمكنك طلب ذلك من المسؤول — مثلًا إذا تم التسجيل مرتين.',
  'Reason': 'السبب',
  '(optional · administrator only)': '(اختياري · للمسؤول فقط)',
  'e.g. My husband already submitted SJAS-0012 for the same children': 'مثال: زوجي سجّل بالفعل SJAS-0012 لنفس الأبناء',
  'Request removal': 'طلب الحذف',
  'Request cancelled': 'تم إلغاء الطلب',
  'Ask the administrator to remove this submission?': 'هل تريد طلب حذف هذا التسجيل من المسؤول؟',
  'Removal request sent to the administrator': 'تم إرسال طلب الحذف إلى المسؤول',

  // Lightbox
  'Payment receipts': 'إيصالات الدفع',
  'Close': 'إغلاق',
  'Payments': 'المدفوعات',
  'Open full size': 'فتح بالحجم الكامل',
  'Ref {ref}': 'مرجع {ref}',
  'Payment {n}': 'دفعة {n}',
  'Total': 'الإجمالي',
  'Payment receipt': 'إيصال دفع',
  'No receipts are available for this record.': 'لا توجد إيصالات متاحة لهذا التسجيل.',
  'Payment receipt {i} of {n}': 'إيصال {i} من {n}',
  'This receipt is a HEIC photo, which this browser cannot display.': 'هذا الإيصال بصيغة HEIC ولا يمكن لهذا المتصفح عرضه.',
  'This receipt could not be loaded.': 'تعذر تحميل هذا الإيصال.',
  'Open / download it': 'فتح / تحميل',
  'Previous receipt': 'الإيصال السابق',
  'Next receipt': 'الإيصال التالي',

  // Form
  'Visible to other parents with the SJAS Bus password': 'يظهر لأولياء الأمور الآخرين الذين لديهم كلمة مرور SJAS Bus',
  'Parent name': 'اسم ولي الأمر',
  'Student names': 'أسماء الطلاب',
  'Bus number & district': 'رقم الباص والمنطقة',
  'Amount paid (each payment, date & reference)': 'المبلغ المدفوع (كل دفعة وتاريخها ورقمها المرجعي)',
  'Uploaded payment screenshots': 'صور إثبات الدفع المرفوعة',
  'Private — administrator only': 'خاص — للمسؤول فقط',
  'Contact phone': 'رقم الموبايل',
  'Notes you add': 'ملاحظاتك',
  'Internal review notes': 'ملاحظات المراجعة الداخلية',
  'Parent full name': 'اسم ولي الأمر بالكامل',
  '(optional · private)': '(اختياري · خاص)',
  'Only the administrator can see this, in case they need to reach you.': 'يظهر للمسؤول فقط، في حال احتاج للتواصل معك.',
  'e.g. 37': 'مثال: 37',
  'e.g. Madinaty': 'مثال: Madinaty',
  'Please write the district in English (e.g. Madinaty) so families on the same bus are grouped together.':
    'يُفضّل كتابة المنطقة بالإنجليزية (مثل Madinaty) حتى تُجمع الأسر على نفس الباص معًا.',
  'Listed as: {label}': 'سيظهر باسم: {label}',
  'Filled in from other {bus} families — change it if yours is different.': 'تم ملؤها من أسر أخرى على {bus} — غيّرها إذا كانت منطقتك مختلفة.',
  'Also on {bus}:': 'أيضًا على {bus}:',
  'Districts of families on {bus}:': 'مناطق الأسر على {bus}:',
  'Families on this bus live in different districts — tap yours below, or type it.': 'الأسر على هذا الباص من مناطق مختلفة — اختر منطقتك من الأسفل أو اكتبها.',
  'No families on {bus} yet. Common districts:': 'لا توجد أسر على {bus} بعد. مناطق شائعة:',
  'Will be listed as "{d}" (same spelling as other families).': 'سيظهر باسم "{d}" (بنفس كتابة الأسر الأخرى).',
  'Did you mean': 'هل تقصد',
  'Buses {a} and {b} were merged. Did you mean': 'تم دمج الباصين {a} و{b}. هل تقصد',
  'Student {n} name': 'اسم الطالب {n}',
  'Remove student {n}': 'حذف الطالب {n}',
  '+ Add another student': '+ إضافة طالب آخر',
  'Payments to the bus company': 'المدفوعات لشركة الباص',
  'Before uploading screenshots': 'قبل رفع الصور',
  'Please crop or cover anything not needed — especially bank balances, account / card numbers and unrelated transactions. The amount, date, and reference are enough. Other parents with the password will be able to see these screenshots.':
    'من فضلك قُص أو غطِّ أي شيء غير ضروري — خصوصًا رصيد الحساب وأرقام الحساب أو الكارت والعمليات الأخرى. يكفي ظهور المبلغ والتاريخ والرقم المرجعي. أولياء الأمور الآخرون الذين لديهم كلمة المرور سيستطيعون رؤية هذه الصور.',
  'Paid in installments? Add each one separately with its own screenshot(s). Accepted: JPG, PNG, HEIC.':
    'دفعت على أقساط؟ أضف كل دفعة على حدة مع صورتها. الصيغ المقبولة: JPG وPNG وHEIC.',
  '+ Add another payment': '+ إضافة دفعة أخرى',
  'Total you paid': 'إجمالي ما دفعته',
  'Notes': 'ملاحظات',
  "I understand that my name, my children's names, bus number, district, amounts paid and payment screenshots will be visible to other parents who have the SJAS Bus access password.":
    'أفهم أن اسمي وأسماء أبنائي ورقم الباص والمنطقة والمبالغ المدفوعة وصور إثبات الدفع ستظهر لأولياء الأمور الآخرين الذين لديهم كلمة مرور SJAS Bus.',
  'Cancel': 'إلغاء',
  'Submit my payment': 'إرسال مدفوعاتي',
  'Save changes': 'حفظ التعديلات',
  'Image': 'صورة',
  'Keep screenshot': 'الإبقاء على الصورة',
  'Remove screenshot': 'حذف الصورة',
  'Remove new screenshot': 'حذف الصورة الجديدة',
  'Remove': 'حذف',
  'Amount paid': 'المبلغ المدفوع',
  'Payment date': 'تاريخ الدفع',
  '(optional)': '(اختياري)',
  'Transaction reference number': 'الرقم المرجعي للعملية',
  'e.g. 504812345678': 'مثال: 504812345678',
  'The number shown on the receipt — not the method (“InstaPay”, “Cash”). Leave empty if there is none.':
    'الرقم الظاهر على الإيصال — وليس طريقة الدفع ("InstaPay" أو "كاش"). اتركه فارغًا إن لم يوجد.',
  'Payment screenshot(s)': 'صور إثبات الدفع',
  'Add screenshot': 'إضافة صورة',
  'Remove Payment {n}?': 'حذف الدفعة {n}؟',
  'Remove Payment {n} and its screenshots?': 'حذف الدفعة {n} وصورها؟',
  'You can add up to {a} screenshots per payment and {b} per save.': 'يمكنك إضافة حتى {a} صور لكل دفعة و{b} صور في كل حفظ.',
  'Preparing images…': 'جارٍ تجهيز الصور…',
  'Only {n} more screenshot(s) could be added here.': 'يمكن إضافة {n} صورة إضافية فقط هنا.',
  '"{name}" is not a JPG, PNG or HEIC image.': '"{name}" ليست صورة بصيغة JPG أو PNG أو HEIC.',
  '"{name}" could not be read as an image.': 'تعذر قراءة "{name}" كصورة.',
  '"{name}" is too large (max 10 MB).': '"{name}" حجمها كبير جدًا (الحد الأقصى 10 ميجابايت).',
  'Please enter the parent full name.': 'من فضلك أدخل اسم ولي الأمر بالكامل.',
  'Please enter the bus number.': 'من فضلك أدخل رقم الباص.',
  'Please enter the district (e.g. Madinaty).': 'من فضلك أدخل المنطقة (مثل Madinaty).',
  'Please enter at least one student name.': 'من فضلك أدخل اسم طالب واحد على الأقل.',
  'Please enter the amount for Payment {n}.': 'من فضلك أدخل مبلغ الدفعة {n}.',
  'Please attach at least one payment screenshot.': 'من فضلك أرفق صورة واحدة على الأقل لإثبات الدفع.',
  'Please tick the box to confirm you understand what other parents can see.': 'من فضلك علّم على المربع لتأكيد أنك تفهم ما سيظهر لأولياء الأمور الآخرين.',
  'Uploading…': 'جارٍ الرفع…',
  'Saving…': 'جارٍ الحفظ…',
  'Something went wrong. Please try again.': 'حدث خطأ. من فضلك حاول مرة أخرى.',
  'EGP': 'جنيه',

  // Messages coming back from the server
  'Incorrect password.': 'كلمة المرور غير صحيحة.',
  'Too many attempts. Please wait 15 minutes and try again.': 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.',
  'Too many attempts. Please try again later.': 'محاولات كثيرة. حاول مرة أخرى لاحقًا.',
  'Please sign in again.': 'من فضلك سجّل الدخول مرة أخرى.',
  'Submission ID or PIN is incorrect.': 'رقم التسجيل أو الرقم السري غير صحيح.',
  'Too many wrong PINs for this submission. Please try again in an hour or contact the administrator.':
    'تم إدخال رقم سري خاطئ عدة مرات لهذا التسجيل. حاول بعد ساعة أو تواصل مع المسؤول.',
  'Please confirm that you understand what will be visible to other parents.': 'من فضلك أكّد أنك تفهم ما سيظهر لأولياء الأمور الآخرين.',
  'Screenshots must be JPG, PNG or HEIC images.': 'يجب أن تكون الصور بصيغة JPG أو PNG أو HEIC.',
  'Each screenshot must be smaller than 10 MB.': 'يجب أن يكون حجم كل صورة أقل من 10 ميجابايت.',
  'Uploading screenshots failed. Please try again.': 'فشل رفع الصور. من فضلك حاول مرة أخرى.',
  'Please keep at least one payment screenshot.': 'من فضلك أبقِ على صورة واحدة على الأقل لإثبات الدفع.',
  'Too many submissions from this connection. Please try again later.': 'تم إرسال تسجيلات كثيرة من هذا الاتصال. حاول مرة أخرى لاحقًا.',
  'Could not reach the server. Please check your connection and try again.': 'تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.',
  'Submission not found.': 'التسجيل غير موجود.',
  'Upload could not be read. Please try again with fewer or smaller images.': 'تعذرت قراءة الملفات المرفوعة. حاول بعدد أقل أو صور أصغر.',
  'Please upload at most 10 screenshots at a time.': 'يمكنك رفع 10 صور كحد أقصى في المرة الواحدة.',
  'Could not load receipts.': 'تعذر تحميل الإيصالات.',
  'Could not load the Excel exporter. Please try again.': 'تعذر تحميل أداة Excel. حاول مرة أخرى.',
  'Parent full name is required': 'اسم ولي الأمر مطلوب',
  'Bus number is required': 'رقم الباص مطلوب',
  'District is required': 'المنطقة مطلوبة',
  'At least one student is required': 'مطلوب اسم طالب واحد على الأقل',
  'At least one payment is required': 'مطلوب دفعة واحدة على الأقل',
  'Each payment needs a valid amount in EGP': 'كل دفعة تحتاج مبلغًا صحيحًا بالجنيه',
  'Contact phone looks invalid': 'رقم الموبايل غير صحيح',
};

const STORE_KEY = 'sjas.lang';
let lang = 'en';

export const getLang = () => lang;
export const isRtl = () => lang === 'ar';

/** t('Text with {x}', { x: 1 }) — returns the Arabic text when Arabic is active. */
export function t(key, vars) {
  let s = lang === 'ar' && Object.prototype.hasOwnProperty.call(AR, key) ? AR[key] : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

/** Server bus labels are "Bus 37"; show "باص 37" in Arabic. */
export function tBus(label) {
  const m = /^Bus (.+)$/.exec(label || '');
  return m ? t('Bus {n}', { n: m[1] }) : label || '';
}

function apply() {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('SJAS Bus — Payment Reconciliation');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}

/** Parent page only: pick the saved language, else the phone's language. */
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
