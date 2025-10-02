
import { GoogleGenAI, Type } from "@google/genai";
import type { AIAnalysisResult, TranslationHistory, Glossary } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    analysis: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          language: { type: Type.STRING },
          evaluation: { 
            type: Type.STRING,
            enum: ['Good', 'Needs Improvement', 'Incorrect'],
          },
          feedback: { type: Type.STRING },
          suggestion: { type: Type.STRING },
        },
        required: ["language", "evaluation", "feedback"]
      },
    },
  },
  required: ["analysis"]
};

const polishFileFinder = (f: { name: string }) => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish');

export const buildAnalysisPrompt = (
  translationKey: string,
  context: string,
  polishTranslation: { lang: string; value: string },
  englishTranslation: { lang: string; value: string } | null,
  translationsToReview: { lang: string; value: string }[],
  translationHistory: TranslationHistory,
  glossary?: Glossary,
  groupReferenceTranslations?: { key: string; translations: { lang: string; value: string }[] }[]
): string => {
    const allTranslationsToAnalyze = [
        polishTranslation,
        ...(englishTranslation ? [englishTranslation] : []),
        ...translationsToReview
    ];

    const translationsString = allTranslationsToAnalyze
        .map(t => `- Language: ${t.lang}, Translation: "${t.value}"`)
        .join('\n');
    
    let glossaryString = "";
    if (glossary && Object.keys(glossary).length > 0) {
        const glossaryEntries = Object.entries(glossary).map(([sourceTerm, translations]) => {
            const translationsText = Object.entries(translations).map(([lang, text]) => `${lang}: "${text}"`).join(', ');
            return `- Termin '${sourceTerm}' (PL) musi być zawsze tłumaczony jako: ${translationsText}. Jest to reguła o najwyższym priorytecie.`;
        }).join('\n');
        glossaryString = `
**Słownik (Glossary - PRIORYTET KRYTYCZNY):**
Poniższe terminy mają zdefiniowane, stałe tłumaczenia. Ich zastosowanie jest obowiązkowe i nadrzędne wobec wszystkich innych reguł. Każde odstępstwo jest błędem krytycznym.
${glossaryEntries}
`;
    }

    let groupReferenceString = "";
    if (groupReferenceTranslations && groupReferenceTranslations.length > 0) {
        const referenceEntries = groupReferenceTranslations.map(ref => {
            const plTranslation = ref.translations.find(t => polishFileFinder({name: t.lang}));
            return `- Klucz '${ref.key}' (wartość PL: "${plTranslation?.value || 'N/A'}") jest absolutnym wzorcem dla tego zadania. Terminologia i frazowanie z tego klucza muszą być ściśle stosowane.`;
        }).join('\n');

        groupReferenceString = `
**Wzorce Kontekstowe Grupy (PRIORYTET WYSOKI):**
Poniższe klucze i ich wartości zostały oznaczone przez użytkownika jako wzorzec dla tej grupy. Mają one bardzo wysoki priorytet.
${referenceEntries}
`;
    }

    let historyContextString = "";
    if (translationHistory && translationHistory[translationKey]) {
        const keyHistory = translationHistory[translationKey];
        const historyEntries = Object.entries(keyHistory)
        .map(([lang, value]) => `- Dla języka '${lang}', ostateczna, zatwierdzona przez użytkownika wersja to: "${value}".`)
        .join('\n');
        
        if (historyEntries) {
        historyContextString = `
**Historia Zmian (PRIORYTET WYSOKI):**
Dla klucza '${translationKey}', użytkownik ręcznie zapisał poniższe wersje. Są to ostateczne i poprawne tłumaczenia.
${historyEntries}
`;
        }
    }

    const prompt = `Jesteś światowej klasy ekspertem lingwistycznym, specjalizującym się w lokalizacji oprogramowania. Twoja praca wymaga absolutnej precyzji. Twoje odpowiedzi (w polach 'feedback' i 'suggestion') MUSZĄ być w języku polskim.

**KRYTYCZNE INSTRUKCJE ZADANIA (NAJWYŻSZY PRIORYTET):**
1.  **ABSOLUTNE ŹRÓDŁO PRAWDY:** Tłumaczenie w języku polskim (PL) jest **jedynym i ostatecznym** punktem odniesienia. Wszystkie inne tłumaczenia muszą być oceniane **WYŁĄCZNIE** pod kątem zgodności z wersją polską pod względem znaczenia, tonu i kontekstu.
2.  **ROLA JĘZYKA ANGIELSKIEGO:** Tłumaczenie angielskie (EN) służy **jedynie jako dodatkowy kontekst**, ale **NIGDY** nie może być traktowane jako wzorzec, jeśli jest niezgodne z wersją polską.
3.  **ZAKAZ INNYCH REFERENCJI:** Pod żadnym pozorem nie używaj żadnego innego języka (np. włoskiego) jako punktu odniesienia. Jest to **błąd krytyczny**.
4.  **WERYFIKACJA ŹRÓDŁA:** Sprawdź również samo tłumaczenie polskie i angielskie pod kątem błędów gramatycznych, literówek czy niezręczności stylistycznych. Jeśli zauważysz problem, wskaż go w ocenie dla danego języka i zasugeruj poprawkę.

Obowiązuje następująca hierarchia ważności informacji (od najważniejszej):
1.  **Słownik (Glossary)**
2.  **Wzorce Kontekstowe Grupy**
3.  **Historia Zmian**
4.  **Źródło Prawdy (Polski)**
5.  **Kontekst Ogólny**

${glossaryString}
${groupReferenceString}
${historyContextString}

**ABSOLUTNE ŹRÓDŁO PRAWDY (POLSKI - ${polishTranslation.lang}):**
"${polishTranslation.value}"

**DODATKOWY PUNKT ODNIESIENIA (ANGIELSKI - ${englishTranslation?.lang || 'N/A'}):**
"${englishTranslation?.value || 'N/A'}"

**Kontekst Ogólny:** "${context}"

**Zadanie:**
Dla każdego tłumaczenia z listy poniżej, wykonaj rygorystyczną ocenę, ściśle trzymając się podanych instrukcji.

**W swojej ocenie, dla każdego języka:**
1.  **'evaluation'**: Użyj jednej z wartości: 'Good', 'Needs Improvement', lub 'Incorrect'.
2.  **'feedback'**: Napisz zwięzłą i szczegółową opinię w języku polskim, która uzasadnia Twoją ocenę. Użyj podstawowego markdownu.
3.  **'suggestion'**: Jeśli ocena to 'Needs Improvement' lub 'Incorrect', podaj **TYLKO I WYŁĄCZNIE sugerowany tekst tłumaczenia**. Jeśli tłumaczenie jest 'Good', pomiń pole 'suggestion'.

**Tłumaczenia do oceny:**
${translationsString}

Zwróć odpowiedź w ustrukturyzowanym formacie JSON, zgodnie z podanym schematem.`;

    return prompt;
};

export const analyzeTranslations = async (
  translationKey: string,
  context: string,
  polishTranslation: { lang: string; value: string },
  englishTranslation: { lang:string; value: string } | null,
  translationsToReview: { lang: string; value: string }[],
  translationHistory: TranslationHistory,
  glossary?: Glossary,
  groupReferenceTranslations?: { key: string; translations: { lang: string; value: string }[] }[]
): Promise<AIAnalysisResult> => {
  
  const prompt = buildAnalysisPrompt(
    translationKey, context, polishTranslation, englishTranslation, translationsToReview,
    translationHistory, glossary, groupReferenceTranslations
  );

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const jsonText = response.text.trim();
    const cleanJsonText = jsonText.replace(/^```json\s*|```$/g, '');
    const parsed = JSON.parse(cleanJsonText);
    return parsed as AIAnalysisResult;

  } catch (error) {
    console.error("Error analyzing translations with AI:", error);
    const errorMessage = String(error);

    if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("403")) {
        throw new Error("AI analysis failed due to a permission error. Please ensure the API key is valid and has the necessary permissions enabled.");
    }
    if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("429")) {
        throw new Error("AI analysis failed: You have exceeded your request quota. Please wait a moment and try again, or check your API plan and billing details.");
    }
    if (errorMessage.toLowerCase().includes("api key not valid")) {
        throw new Error("AI analysis failed: The provided API key is not valid. Please check your API key and try again.");
    }

    throw new Error("Failed to get analysis from AI. An unknown error occurred. Please check the console for more details.");
  }
};

export const buildGenerateContextPrompt = (
  translationKey: string,
  translations: { lang: string; value: string }[],
): string => {
  const translationsString = translations
    .map(t => `- Language: ${t.lang}, Translation: "${t.value}"`)
    .join('\n');

  const prompt = `Jesteś specjalistą od UX i lokalizacji. Twoim zadaniem jest stworzenie krótkiego, ale precyzyjnego opisu kontekstu dla klucza tłumaczenia w aplikacji. Opis musi być w języku polskim. Na podstawie nazwy klucza i jego istniejących wartości, opisz, gdzie i w jakim celu ten tekst może być używany w interfejsie użytkownika.

Klucz: "${translationKey}"

Istniejące Tłumaczenia:
${translationsString}

Sugerowany Kontekst (odpowiedz TYLKO I WYŁĄCZNIE sugerowanym tekstem opisu, bez żadnych dodatkowych wstępów, formatowania markdown, cudzysłowów czy nagłówków typu "Sugerowany Kontekst:"):`;
  
  return prompt;
};


export const generateContextForKey = async (
  translationKey: string,
  translations: { lang: string; value: string }[]
): Promise<string> => {
  
  const prompt = buildGenerateContextPrompt(translationKey, translations);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();

  } catch (error) {
    console.error("Error generating context with AI:", error);
    const errorMessage = String(error);

    if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("403")) {
        throw new Error("AI context suggestion failed due to a permission error. Please ensure the API key is valid and has the necessary permissions enabled.");
    }

    if (errorMessage.toLowerCase().includes("api key not valid")) {
        throw new Error("AI context suggestion failed: The provided API key is not valid. Please check your API key and try again.");
    }

    throw new Error("Failed to get context suggestion from AI. An unknown error occurred. Please check the console for more details.");
  }
};


const bulkTranslateSchema = {
    type: Type.OBJECT,
    properties: {
        translations: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    key: { type: Type.STRING },
                    suggestion: { type: Type.STRING }
                },
                required: ["key", "suggestion"]
            }
        }
    },
    required: ["translations"]
};

const buildBulkTranslatePrompt = (
    keysToTranslate: { key: string, pl: string, en: string, context: string, currentValue: string }[],
    targetLang: string,
    history: TranslationHistory,
    glossary: Glossary,
    globalContext: string
) => {
    
    const historyString = Object.entries(history)
        .map(([key, translations]) => {
            const approvedTranslation = translations[targetLang];
            if (approvedTranslation) {
                return `- Klucz '${key}': zatwierdzona wersja to "${approvedTranslation}".`;
            }
            return null;
        })
        .filter(Boolean)
        .join('\n');
        
    const glossaryString = Object.entries(glossary)
        .map(([sourceTerm, translations]) => {
            const targetTranslation = translations[targetLang];
            if (targetTranslation) {
                return `- Polski termin '${sourceTerm}' musi być przetłumaczony jako "${targetTranslation}".`;
            }
            return null;
        })
        .filter(Boolean)
        .join('\n');

    const keysString = keysToTranslate.map(k => 
`
- Key: "${k.key}"
  Polish (Source of Truth): "${k.pl}"
  English (Reference): "${k.en}"
  Context for this key: "${k.context || 'Brak'}"
  Current Value: "${k.currentValue || '(empty)'}"
`
    ).join('');

    return `Jesteś ekspertem od lokalizacji oprogramowania. Twoim zadaniem jest przetłumaczenie grupy kluczy na język docelowy: **${targetLang}**.

**Kontekst Globalny Aplikacji:**
${globalContext || "Brak ogólnego kontekstu. Skup się na poszczególnych kluczach."}

**KRYTYCZNE ZASADY (NAJWYŻSZY PRIORYTET):**
1.  **Słownik (Glossary):** Poniższe terminy MUSZĄ być przetłumaczone dokładnie tak, jak podano. Jest to absolutnie nadrzędna reguła.
2.  **Źródło Prawdy:** Język **polski** jest absolutnym źródłem prawdy dla znaczenia.
3.  **Kontekst Pomocniczy:** Język **angielski** oraz kontekst dla klucza służą jako dodatkowy kontekst.
4.  **Spójność:** Zachowaj absolutną spójność terminologii i stylu we wszystkich tłumaczeniach w tej grupie. Jeśli słowo "Zapisz" w jednym kluczu jest tłumaczone jako "Save", w innym kluczu nie może być "Store". Ta spójność jest kluczowa.
5.  **Historia:** Poniżej znajduje się lista wcześniej zatwierdzonych przez człowieka tłumaczeń. Mają one wysoki priorytet.
6.  **Format Wyjściowy:** Zwróć **TYLKO I WYŁĄCZNIE** obiekt JSON. Nie dołączaj żadnego dodatkowego tekstu ani formatowania markdown.

**Słownik dla języka ${targetLang} (PRIORYTET KRYTYCZNY):**
${glossaryString || "Brak słownika dla tego języka."}

**Zatwierdzona historia dla języka ${targetLang} (PRIORYTET WYSOKI):**
${historyString || "Brak historii dla tego języka."}

**Klucze do przetłumaczenia:**
${keysString}

Na podstawie powyższych danych, wygeneruj tłumaczenia dla każdego klucza na język **${targetLang}**. Zwróć wynik jako obiekt JSON zgodny z podanym schematem.
`;
}

export const bulkTranslateKeys = async (
    keysToTranslate: { key: string, pl: string, en: string, context: string, currentValue: string }[],
    targetLang: string,
    history: TranslationHistory,
    glossary: Glossary,
    globalContext: string,
    onProgress: (progress: { current: number, total: number }) => void
): Promise<{ key: string, suggestion: string }[]> => {
    const CHUNK_SIZE = 10; // Process 10 keys per API call
    const DELAY_MS = 1000; // 1-second delay between chunks to avoid rate limits
    const totalKeys = keysToTranslate.length;
    let processedCount = 0;
    const allSuggestions: { key: string, suggestion: string }[] = [];

    for (let i = 0; i < totalKeys; i += CHUNK_SIZE) {
        const chunk = keysToTranslate.slice(i, i + CHUNK_SIZE);
        const prompt = buildBulkTranslatePrompt(chunk, targetLang, history, glossary, globalContext);

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: bulkTranslateSchema,
                }
            });

            const jsonText = response.text.trim();
            const cleanJsonText = jsonText.replace(/^```json\s*|```$/g, '');
            const parsed = JSON.parse(cleanJsonText);
            
            if (parsed.translations && Array.isArray(parsed.translations)) {
                allSuggestions.push(...parsed.translations);
            }
            
        } catch (error) {
            console.error(`Error processing chunk ${i / CHUNK_SIZE + 1}:`, error);
            // Optionally, re-throw or handle the error for the entire process
            const errorMessage = String(error);
             if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("429")) {
                throw new Error(`AI translation failed on a batch: You have exceeded your request quota. Please wait a moment and try again. (${chunk.length} keys in this batch were not translated).`);
            }
        }

        processedCount += chunk.length;
        onProgress({ current: processedCount, total: totalKeys });

        if (i + CHUNK_SIZE < totalKeys) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    return allSuggestions;
};
