// script.js
// Вставьте сюда ID вашей Google Таблицы
const SPREADSHEET_ID = '138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4';

// URL-ы для получения данных из Google Таблиц в формате JSON
const BALANCES_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=1133040566`;
const TRANSACTIONS_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=224436106`;

// Объявляем переменные для хранения данных таблиц в глобальной области видимости
let balancesData = [];
let debtorsSummaryData = []; // Будет хранить детализированные данные по должникам

// --- Функция: Парсинг JSON-ответа от Google Sheets (без изменений) ---
function parseGoogleSheetJSON(jsonText) {
    try {
        const jsonString = jsonText.substring(jsonText.indexOf('{'), jsonText.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonString);

        const headers = data.table.cols.map(col => col.label || col.id);
        const rows = data.table.rows;

        const parsedData = rows.map(row => {
            const rowObject = {};
            headers.forEach((header, index) => {
                let value = null;
                const cell = row.c[index];

                if (cell) {
                    if (cell.f && typeof cell.f === 'string' && /^\d{2}\.\d{2}\.\d{4}/.test(cell.f)) {
                        value = cell.f;
                    } else if (cell.v !== undefined) {
                        value = cell.v;
                    }
                }

                if (Array.isArray(value) && value.length >= 3) {
                    const [year, month, day, hour = 0, minute = 0, second = 0] = value;
                    const date = new Date(year, month, day, hour, minute, second);
                    value = date.toLocaleDateString('ru-RU', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    if (value.endsWith(' 00:00:00')) {
                        value = value.substring(0, value.length - 9);
                    }
                } else if (typeof value === 'string' && value.startsWith('Date(') && value.endsWith(')')) {
                    try {
                        const dateParts = value.substring(5, value.length - 1).split(',').map(Number);
                        if (dateParts.length >= 3) {
                            const [year, month, day, hour = 0, minute = 0, second = 0] = dateParts;
                            const date = new Date(year, month, day, hour, minute, second);
                            value = date.toLocaleDateString('ru-RU', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                            });
                             if (value.endsWith(' 00:00:00')) {
                                 value = value.substring(0, value.length - 9);
                             }
                        }
                    } catch (parseError) {
                        console.warn('Could not parse date string (Date(Y,M,D) format):', value, parseError);
                        value = '';
                    }
                }

                if (typeof value === 'boolean') {
                    value = value ? 'Да' : 'Нет';
                }

                if (value === undefined || value === null) {
                    value = '';
                }

                rowObject[header] = value;
            });
            return rowObject;
        });

        return parsedData;
    } catch (e) {
        console.error('Ошибка парсинга JSON от Google Sheet:', e, 'Исходный текст:', jsonText);
        return null;
    }
}

// --- Функция для загрузки данных (без изменений) ---
async function loadGoogleSheetData(url) {
    if (!url) {
        console.error('URL для загрузки данных не предоставлен.');
        return null;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from ${url}`);
        }
        const text = await response.text();
        return parseGoogleSheetJSON(text);

    } catch (error) {
        console.error('Ошибка загрузки данных Google Sheet:', error);
        if (error.message.includes('blocked by CORS policy') || error.message.includes('404')) {
            console.error("Возможно, URL неверен, или лист не опубликован должным образом, или есть проблемы с доступом. Убедитесь, что лист опубликован 'для всех, у кого есть ссылка'.");
        }
        return null;
    }
}

// --- Функция для отображения данных в таблице (без изменений) ---
function renderTable(data, containerId, headersMap, uniqueByKey = null, tableClass = null, limit = 'all') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Контейнер с ID "${containerId}" не найден.`);
        return;
    }

    const loadingMessage = container.previousElementSibling;
    if (loadingMessage && loadingMessage.classList.contains('loading')) {
        loadingMessage.style.display = 'none';
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>Данные отсутствуют.</p>';
        return;
    }

    let processedData = [...data];

    if (uniqueByKey && data.length > 0) {
        const seenKeys = new Set();
        processedData = processedData.filter(row => {
            const keyValue = row[uniqueByKey];
            if (keyValue === null || keyValue === undefined || keyValue === '' || seenKeys.has(keyValue)) {
                return false;
            }
            seenKeys.add(keyValue);
            return true;
        });

        if (processedData.length === 0 && data.length > 0) {
            const keyLabel = headersMap.find(h => h.key === uniqueByKey)?.label || uniqueByKey;
            console.warn(`Все строки были отфильтрованы при попытке получить уникальные значения по ключу "${keyLabel}". Проверьте данные или ключ.`);
            container.innerHTML = `<p>Нет уникальных данных по полю "${keyLabel}".</p>`;
            return;
        }
    }

    if (limit !== 'all' && typeof limit === 'number' && processedData.length > limit) {
        processedData = processedData.slice(-limit);
    }

    const table = document.createElement('table');
    if (tableClass) {
        table.classList.add(tableClass);
    }
    const thead = table.createTHead();
    const tbody = table.createTBody();
    const headerRow = thead.insertRow();

    const displayHeaders = headersMap && headersMap.length > 0 ? headersMap : Object.keys(processedData[0]).map(key => ({ key, label: key }));

    displayHeaders.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h.label;
        headerRow.appendChild(th);
    });

    processedData.forEach(rowData => {
        const row = tbody.insertRow();
        displayHeaders.forEach(h => {
            const cell = row.insertCell();
            cell.textContent = (rowData[h.key] !== null && rowData[h.key] !== undefined && rowData[h.key] !== '') ? rowData[h.key] : '';
        });
    });

    container.innerHTML = '';
    container.appendChild(table);
}

// --- Загрузка и отображение данных при загрузке страницы ---
document.addEventListener('DOMContentLoaded', async () => {
    // - Загружаем Движение материалов (Остатки) - (без изменений)
    const balancesHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Материал', label: 'Материал' },
        { key: 'Начальный остаток', label: 'Начальный остаток' },
        { key: 'Приход', label: 'Приход' },
        { key: 'Расход', label: 'Расход' },
        { key: 'Списание', label: 'Списание' },
        { key: 'Возврат', label: 'Возврат' },
        { key: 'Сейчас на складе', label: 'Сейчас на складе' }
    ];
    const loadedBalances = await loadGoogleSheetData(BALANCES_URL);

    if (loadedBalances) {
        let tempBalancesData = loadedBalances;
        const quantityKey = 'Сейчас на складе';
        tempBalancesData = tempBalancesData.filter(row => {
            const quantity = row[quantityKey];
            return typeof quantity === 'number' && !isNaN(quantity) && quantity > 0;
        });
        balancesData = tempBalancesData;

        if (balancesData.length === 0) {
            const container = document.getElementById('balances-table-container');
            if (container) container.innerHTML = '<p>В данный момент нет материалов на складе (остаток > 0).</p>';
            const loading = document.getElementById('balances-loading');
            if (loading) loading.style.display = 'none';
        } else {
            renderTable(balancesData, 'balances-table-container', balancesHeaders, null, 'balances-table');
        }
    } else {
        const container = document.getElementById('balances-table-container');
        if (container) container.innerHTML = '<p class="error-message">Не удалось загрузить данные об остатках. Проверьте URL или настройки публикации.</p>';
        const loading = document.getElementById('balances-loading');
        if (loading) loading.style.display = 'none';
    }

    // --- Загружаем и агрегируем данные для должников ---
    const loadedTransactions = await loadGoogleSheetData(TRANSACTIONS_URL);

    if (loadedTransactions) {
        const debtorsTransactions = loadedTransactions.filter(row => row['Тип'] === 'Должен');
        const summaryMap = new Map();

        // Сначала агрегируем долги, чтобы получить общие суммы по каждому сотруднику и материалу
        debtorsTransactions.forEach(transaction => {
            const employee = transaction['Сотрудник'];
            const material = transaction['Материал'];
            const quantity = parseFloat(String(transaction['Кол-во']).replace(',', '.'));

            if (employee && material && !isNaN(quantity)) {
                if (!summaryMap.has(employee)) {
                    summaryMap.set(employee, {});
                }
                const employeeDebts = summaryMap.get(employee);
                employeeDebts[material] = (employeeDebts[material] || 0) + quantity;
            }
        });

        // Теперь формируем новый массив в требуемом формате
        let currentDebtorsData = [];
        let uniqueEmployeeCounter = 0; // Счетчик для уникальных фамилий

        // Сортируем сотрудников по фамилии для последовательности
        const sortedEmployees = Array.from(summaryMap.keys()).sort();

        sortedEmployees.forEach(employee => {
            uniqueEmployeeCounter++; // Увеличиваем счетчик для каждой новой уникальной фамилии
            const debts = summaryMap.get(employee);
            // Сортируем материалы для каждого сотрудника
            const sortedMaterials = Object.keys(debts).sort();

            let isFirstMaterialForEmployee = true; // Флаг для первой записи сотрудника

            sortedMaterials.forEach(material => {
                currentDebtorsData.push({
                    '№ п/п': isFirstMaterialForEmployee ? uniqueEmployeeCounter : '', // Номер только для первой записи
                    'Фамилия должника': isFirstMaterialForEmployee ? employee : '', // Фамилия только для первой записи
                    'Материал': material,
                    'Количество': debts[material]
                });
                isFirstMaterialForEmployee = false; // После первой записи, сбрасываем флаг
            });
        });

        debtorsSummaryData = currentDebtorsData; // Обновляем глобальную переменную

        // Определяем заголовки для новой структуры таблицы должников
        const debtorsTableHeaders = [
            { key: '№ п/п', label: '№ п/п' },
            { key: 'Фамилия должника', label: 'Фамилия должника' },
            { key: 'Материал', label: 'Материал' },
            { key: 'Количество', label: 'Количество' }
        ];

        // Рендерим "Долги по сотрудникам" с новой структурой
        renderTable(debtorsSummaryData, 'debtors-table-container', debtorsTableHeaders, null, 'debtors-table', 'all');

    } else {
        const debtorsContainer = document.getElementById('debtors-table-container');
        if (debtorsContainer) debtorsContainer.innerHTML = '<p class="error-message">Не удалось загрузить данные о долгах. Проверьте URL или настройки публикации.</p>';
        const debtorsLoading = document.getElementById('debtors-loading');
        if (debtorsLoading) debtorsLoading.style.display = 'none';
    }
});
