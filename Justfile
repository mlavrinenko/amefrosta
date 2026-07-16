check: lint test

lint:
    tsc --noEmit

test:
    vitest run

build:
    vite build

dev:
    vite --host 0.0.0.0

preview:
    vite preview

rules-to-text:
    pdftotext -layout 'var/AMftS_rulebook_v9.pdf' var/en.txt
    pdftotext -layout 'var/Послание из космоса. Правила игры.pdf' var/ru.txt
