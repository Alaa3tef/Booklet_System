

export interface MockPrintingRow  {
  governorateCode: string;
  subjectCode: string;
  committeeNumber: string;
}

const GOVERNORATES = [
  { code: 'cairo', label: 'القاهرة' },
  { code: 'giza', label: 'الجيزة' },
  { code: 'monufia', label: 'المنوفية' }
];

const SUBJECTS = [
  { code: 'arabic', label: 'اللغة العربية' },
  { code: 'math', label: 'الرياضيات' },
  { code: 'science', label: 'العلوم' }
];

const STATUSES = [
  { status: 'قيد الطباعة', statusTone: 'info' },
  { status: 'تم الانتهاء', statusTone: 'success' },
  { status: 'قيد الطباعة', statusTone: 'info' },
  { status: 'مرفوض', statusTone: 'danger' }
];

export const MOCK_ROWS: MockPrintingRow[] = Array.from({ length: 23 }, (_, i) => {
  const gov = GOVERNORATES[i % 3];
  const subject = SUBJECTS[i % 3 === 0 ? (i + 1) % 3 : i % 3];
  const st = STATUSES[i % 4];

  return {
    id: i + 1, // خلّيه يطابق ids موجودة عندكم لو هتجربي endpoints حقيقية
    index: i + 1,
    governorate: gov.label,
    governorateCode: gov.code,
    subject: subject.label,
    subjectCode: subject.code,
    committeeNumber: String(101 + (i % 5)),
    status: st.status,
    statusTone: st.statusTone,
    rejectionReason:
      st.status === 'مرفوض'
        ? 'يوجد خطأ في بعض صفحات المادة، كما أن ترتيب الأسئلة يحتاج إلى مراجعة قبل إعادة الطباعة.'
        : undefined
  } as MockPrintingRow;
});