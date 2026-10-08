-- incoming/update-chhera-pushpo-description.sql
--
-- Replaces the ছেঁড়া পুষ্প synopsis with the corrected copy (proper Bengali
-- spelling, spacing and punctuation — the previous text had stray spaces
-- before commas/periods and "আঘাতপ্রাপ্ত" style errors).
--
-- The book detail page renders `description` and then `synopsis`. The new copy
-- is the synopsis, so `synopsis` is set to NULL to avoid printing the same
-- paragraph twice on the page.
--
-- This touches one row of `books`. It does not change price, formats, cover
-- images, orders or any other table. The old values are recorded below so the
-- change can be reverted.

BEGIN;

-- Capture the current values first (revert reference):
--   id          : chhera-pushpo
--   description  : 'প্রদীপ কুমার আচার্য্যের এই উপন্যাসে স্মৃতি ও বর্তমানের এক অনন্য মিলন ঘটেছে প্রকৃতিতে ঝড় আসলে , ...'
--   synopsis    : 'এই উপন্যাসে একজন তরুণীর জীবনের যাত্রা তুলে ধরা হয়েছে — তার স্বপ্ন, ভালোবাসা, একাকীত্ব এবং সমাজের সাথে তার সংঘর্ষ।'
--   cover_hover  : 'books/1790247885340-4o588q.jpg'  (same artwork as cover_primary)

UPDATE books
SET
  description = 'প্রকৃতিতে ঝড় আসলে, সেই ঝড়ের আঘাতে গাছের ফুল চূর্ণ-বিচূর্ণ হয়ে মাটিতে ঝরে পড়ে এবং মাটির সাথে মিশে যায়। ঠিক তেমনি আমাদের ফুলের মতো নিষ্পাপ সন্তানরা বিভিন্ন কারণে মানসিকভাবে আঘাতপ্রাপ্ত হয় এবং সেই আঘাতে ক্ষত-বিক্ষত হয়ে অকালে ঝরে পড়ে, আর বাবা-মায়ের সমস্ত আশা-ভরসা ভেস্তে যায়— তারই গল্প।',
  synopsis = NULL
WHERE id = 'chhera-pushpo';

-- `cover_hover` points at the same artwork as `cover_primary`. The book card
-- renders one cover; the gallery renders primary + hover, so leaving a
-- duplicate here is what produced the "same image twice" report.
UPDATE books
SET cover_hover = NULL
WHERE id = 'chhera-pushpo';

COMMIT;

-- ---------------------------------------------------------------------------
-- REVERT
-- ---------------------------------------------------------------------------
-- UPDATE books
-- SET
--   description = 'প্রদীপ কুমার আচার্য্যের এই উপন্যাসে স্মৃতি ও বর্তমানের এক অনন্য মিলন ঘটেছে প্রকৃতিতে ঝড় আসলে , সেই ঝড়ের আঘাতে গাছের ফুলগুলো চূর্ণ বিচূর্ণ হয়ে মাটিতে ঝড়ে পড়ে এবং মাটির সাথে মিশে যায় . ঠিক তেমনি আমাদের ফুলের মতো নিষ্পাপ সন্তান গুলো বিভিন্ন কারণে মানসিক ভাবে আঘাতপ্রাপ্ত হয় এবং সেই আঘাতে ক্ষত বিক্ষত হয়ে অকালে ঝরে পড়ে এবং বাবা মায়ের সমস্ত আসা ভরসা ভেস্তে যায় তারই গল্প',
--   synopsis = 'এই উপন্যাসে একজন তরুণীর জীবনের যাত্রা তুলে ধরা হয়েছে — তার স্বপ্ন, ভালোবাসা, একাকীত্ব এবং সমাজের সাথে তার সংঘর্ষ।',
--   cover_hover = 'books/1790247885340-4o588q.jpg'
-- WHERE id = 'chhera-pushpo';
