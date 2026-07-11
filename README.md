# Domowe Finanse

> Wspólna aplikacja do monitorowania wydatków gospodarstwa domowego, z osobnymi kontami użytkowników i wsparciem AI przy odczytywaniu paragonów.

## Cel projektu

„Domowe Finanse” ma ułatwiać członkom jednego gospodarstwa domowego rejestrowanie, porządkowanie i analizowanie wspólnych wydatków. Aplikacja ma łączyć wydatki wpisane ręcznie z danymi pozyskanymi ze zdjęć paragonów, a w późniejszych etapach także z wyciągów bankowych i notatek dotyczących inwestycji.

Najważniejszym rezultatem jest wiarygodny, wspólny obraz domowych finansów, w którym użytkownicy mogą sprawdzić, na co wydawane są pieniądze i poprawić każdą błędną klasyfikację.

## Użytkownicy i model dostępu

- Aplikacja jest przeznaczona wyłącznie do prywatnego użytku domowego.
- Każdy użytkownik ma własne konto, login i hasło.
- Dane należą do wspólnego **gospodarstwa domowego**, a nie do pojedynczego użytkownika.
- Właściciel gospodarstwa tworzy je i zaprasza kolejnych członków.
- Członkowie widzą oraz mogą edytować wspólne wydatki i kategorie w obrębie swojego gospodarstwa.
- Użytkownik nie może odczytać ani zmienić danych innego gospodarstwa domowego.

## Główny przepływ użytkownika

1. Właściciel zakłada gospodarstwo domowe i zaprasza członków.
2. Użytkownik dodaje wydatek ręcznie albo przesyła zdjęcie paragonu.
3. Dla paragonu system rozpoznaje pozycje, kwoty i proponuje kategorie.
4. Wyniki o wysokiej pewności mogą zostać przyjęte automatycznie, a niepewne są oznaczone do weryfikacji.
5. Użytkownik poprawia dane lub kategorię, gdy jest to potrzebne.
6. Wszyscy członkowie gospodarstwa korzystają ze wspólnego zestawienia wydatków.

## Zakres MVP

Pierwsza użyteczna wersja obejmuje:

- rejestrację, logowanie i zarządzanie członkami gospodarstwa;
- role: właściciel gospodarstwa i członek gospodarstwa;
- ręczne dodawanie oraz edycję wydatków;
- przesyłanie zdjęć paragonów;
- odczyt paragonu przez AI/OCR: sprzedawca, data, pozycje, ilości i kwoty, jeśli są dostępne;
- propozycję kategorii dla pozycji lub całego wydatku;
- kolejkę pozycji wymagających weryfikacji;
- predefiniowane kategorie oraz tworzenie własnych;
- ręczne lub wspomagane przez AI przekategoryzowanie wydatków historycznych;
- przegląd listy wydatków i podstawowych podsumowań według kategorii;
- responsywną aplikację webową PWA, wygodną na komputerze, Androidzie oraz urządzeniach Apple.

### Poza zakresem MVP

Funkcje poniżej są planowane, ale nie powinny opóźniać pierwszej wersji:

- import i analiza wyciągów bankowych;
- wykrywanie oraz łączenie duplikatów między wyciągiem a paragonem;
- notatki i ewidencja inwestycji giełdowych;
- zaawansowane budżety, cele oszczędnościowe i prognozy;
- osobne aplikacje natywne na Androida i iOS.

## Kategorie wydatków

Aplikacja startuje z prostym zestawem kategorii, na przykład: żywność, dom i rachunki, transport, zdrowie, rozrywka, edukacja, zakupy, dzieci i inne.

Każde gospodarstwo może tworzyć dodatkowe kategorie. Użytkownik może ręcznie zmienić kategorię pojedynczej pozycji lub wydatku, również dla wpisów archiwalnych. W przyszłości AI może proponować zmianę kategorii na podstawie korekt wykonywanych wcześniej przez użytkowników, ale decyzja użytkownika ma pierwszeństwo.

## Zasady wykorzystania AI

AI jest pomocą w wprowadzaniu danych, nie nieomylnym źródłem prawdy.

- Model analizuje zdjęcie paragonu i zwraca ustrukturyzowaną propozycję danych oraz kategorii.
- System zapisuje poziom pewności rozpoznania i kategoryzacji.
- Wyniki o niskiej pewności wymagają przeglądu przed uznaniem ich za poprawne.
- Użytkownik zawsze może edytować rozpoznane dane, zaakceptować je lub odrzucić.
- Integracja AI działa po stronie zaufanej usługi serwerowej; klucze dostępu do dostawcy AI nie trafiają do aplikacji w przeglądarce.
- Wybór konkretnego dostawcy OCR/AI zostanie dokonany przed implementacją analizy paragonów, po ocenie jakości dla polskich paragonów, prywatności i kosztu.

## Proponowana architektura

| Obszar | Założenie |
| --- | --- |
| Frontend | React, TypeScript i Vite |
| Dostęp na urządzeniach | Responsywna aplikacja webowa PWA |
| Dane i logowanie | Supabase Postgres oraz Supabase Auth |
| Autoryzacja | Row Level Security (RLS) ograniczające dane do gospodarstwa użytkownika |
| Logika zaufana | Supabase Edge Functions, gdy operacja wymaga sekretu, integracji AI lub dodatkowej walidacji |
| Hosting publiczny | Cloudflare Pages lub Workers Static Assets |
| Testy | Vitest, React Testing Library oraz wybrane scenariusze end-to-end |

Cloudflare Worker nie jest planowany na start. Zostanie rozważony tylko wtedy, gdy potrzebna będzie dodatkowa warstwa ochrony, limitowania ruchu lub integracji z zewnętrzną usługą, której nie obsłuży prościej Supabase Edge Function.

## Dane, prywatność i bezpieczeństwo

Projekt przetwarza prywatne dane finansowe, dlatego bezpieczeństwo jest wymaganiem podstawowym.

- Każda tabela udostępniona przez API będzie miała włączone RLS oraz polityki ograniczające dostęp do członków właściwego gospodarstwa.
- Uprawnienie `authenticated` samo w sobie nie wystarcza: polityki muszą weryfikować przynależność do gospodarstwa.
- Klucze tajne, w tym klucze serwisowe Supabase i klucze dostawcy AI, pozostają wyłącznie po stronie serwera.
- Zdjęcia paragonów będą dostępne tylko członkom gospodarstwa, do którego należą.
- Dane z paragonu i dane finansowe nie będą wykorzystywane jako dane treningowe bez wyraźnej decyzji użytkowników i oceny regulaminu dostawcy AI.
- Formularze i interfejs nie zastępują kontroli dostępu po stronie bazy danych; przeglądarka jest środowiskiem niezaufanym.

Szczegółowy model danych, polityki RLS, retencja zdjęć oraz proces usuwania konta zostaną opisane i zatwierdzone przed pracami nad bazą danych.

## Plan budowy

### Etap 0 — doprecyzowanie produktu

- Ustalenie modelu danych, reguł kategorii i widoków podsumowań.
- Zdefiniowanie polityk właściciela i członka gospodarstwa.
- Ocena dostawców OCR/AI na reprezentatywnych polskich paragonach.

### Etap 1 — wspólne gospodarstwo i ręczne wydatki

- Logowanie, tworzenie gospodarstwa i zapraszanie członków.
- Bezpieczny model danych z RLS.
- Dodawanie, edycja, kategoryzacja i przegląd ręcznych wydatków.

### Etap 2 — paragony i weryfikacja AI

- Prywatne przechowywanie zdjęć paragonów.
- Serwerowa analiza zdjęć, obsługa błędów i statusów przetwarzania.
- Widok weryfikacji oraz korekta danych i kategorii.

### Etap 3 — agregacja z kolejnych źródeł

- Import wyciągów bankowych w uzgodnionych formatach.
- Zapobieganie podwójnemu liczeniu transakcji i paragonów.
- Notatki oraz ewidencja inwestycji jako osobny, wyraźnie oznaczony moduł.

## Kryteria akceptacji dla MVP

1. Właściciel może utworzyć gospodarstwo i zaprosić członka z osobnym kontem.
2. Członek gospodarstwa widzi wspólne wydatki, ale nie ma dostępu do danych innych gospodarstw.
3. Użytkownik może dodać, poprawić i skategoryzować wydatek ręcznie.
4. Użytkownik może przesłać paragon, zobaczyć propozycję danych i poprawić ją przed użyciem.
5. Niepewne wyniki AI są wyraźnie oznaczone do weryfikacji.
6. Użytkownik może dodać własną kategorię i przypisać ją do istniejącego wydatku.
7. Interfejs pozostaje użyteczny na ekranie telefonu i komputera.

## Ryzyka i pytania do rozwiązania

- **Jakość OCR i klasyfikacji:** paragony różnią się układem, jakością zdjęcia i nazwami produktów; konieczna jest weryfikacja przez użytkownika.
- **Duplikaty:** ten sam zakup może pojawić się jako paragon i transakcja bankowa; reguły ich łączenia wymagają osobnego projektu przed importem wyciągów.
- **Formaty bankowe:** banki oferują różne formaty eksportu i różny zakres danych.
- **Koszt i prywatność AI:** wybór dostawcy wpłynie na jakość rozpoznawania, koszt działania i sposób przetwarzania zdjęć.
- **Dane wrażliwe:** trzeba zdefiniować retencję paragonów, eksport danych, usuwanie konta oraz zasady odzyskiwania dostępu.

## Stan projektu

Na obecnym etapie projekt zawiera wyłącznie założenia. Nie ma jeszcze kodu, schematu bazy danych, konfiguracji Supabase, konfiguracji Cloudflare ani integracji z usługą AI.
