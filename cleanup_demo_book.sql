-- Complete cleanup for "The Laws of Human Nature" (demo book)
-- Book ID: 26176a72-23b8-4c8c-808f-0f9acf5e02c2

-- 1. Delete order_items for this book's formats
DELETE FROM order_items
WHERE format_id IN (SELECT id FROM book_formats WHERE book_id = '26176a72-23b8-4c8c-808f-0f9acf5e02c2');

-- 2. Delete orders that only had this book's items (and are now empty)
DELETE FROM orders
WHERE id IN (
    SELECT o.id FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.id IS NULL
);

-- 3. Delete digital_assets for this book's formats
DELETE FROM digital_assets
WHERE format_id IN (SELECT id FROM book_formats WHERE book_id = '26176a72-23b8-4c8c-808f-0f9acf5e02c2');

-- 4. Delete book_formats
DELETE FROM book_formats WHERE book_id = '26176a72-23b8-4c8c-808f-0f9acf5e02c2';

-- 5. Delete the book
DELETE FROM books WHERE id = '26176a72-23b8-4c8c-808f-0f9acf5e02c2';