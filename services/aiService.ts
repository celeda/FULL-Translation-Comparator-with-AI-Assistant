import { GoogleGenAI, Type } from "@google/genai";
import type { AIAnalysisResult, TranslationHistory, AnalysisItem } from '../types';

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

const polishFileFinder = (f: { name: string }) => {
    const lowerName = f.name.toLowerCase();
    return lowerName === 'pl' || lowerName === 'polish';
};

export const buildAnalysisPrompt = (
  translationKey: string,
  context: string,
  polishTranslation: { lang: string; value: string },
  englishTranslation: { lang: string; value: string } | null,
  translationsToReview: { lang: string; value: string }[],
  translationHistory: TranslationHistory,
  groupReferenceTranslations?: { key: string; translations: { lang: string; value: string }[] }[],
  globalContext?: string,
): string => {
    const allTranslationsToAnalyze = [
        ...translationsToReview
    ];

    const translationsString = allTranslationsToAnalyze
        .map(t => `- Language: ${t.lang}, Translation: "${t.value}"`)
        .join('\n');
    
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
    
    let globalContextString = "";
    if (globalContext) {
        globalContextString = `
**Kontekst Globalny Aplikacji:**
${globalContext}
`;
    }

    const prompt = `Jesteś światowej klasy ekspertem lingwistycznym, specjalizującym się w lokalizacji oprogramowania. Twoja praca wymaga absolutnej precyzji. Twoje odpowiedzi (w polach 'feedback' i 'suggestion') MUSZĄ być w języku polskim.

**KRYTYCZNE INSTRUKCJE ZADANIA (NAJWYŻSZY PRIORYTET):**
1.  **ABSOLUTNE ŹRÓDŁO PRAWDY:** Tłumaczenie w języku polskim (PL) jest **jedynym i ostatecznym** punktem odniesienia. Wszystkie inne tłumaczenia muszą być oceniane **WYŁĄCZNIE** pod kątem zgodności z wersją polską pod względem znaczenia, tonu i kontekstu.
2.  **ROLA JĘZYKA ANGIELSKIEGO:** Tłumaczenie angielskie (EN) służy **jedynie jako dodatkowy kontekst**, ale **NIGDY** nie może być traktowane jako wzorzec, jeśli jest niezgodne z wersją polską.
3.  **ZAKAZ INNYCH REFERENCJI:** Pod żadnym pozorem nie używaj żadnego innego języka (np. włoskiego) jako punktu odniesienia. Jest to **błąd krytyczny**.

Obowiązuje następująca hierarchia ważności informacji (od najważniejszej):
1.  **Wzorce Kontekstowe Grupy**
2.  **Historia Zmian**
3.  **Źródło Prawdy (Polski)**
4.  **Kontekst Globalny Aplikacji**
5.  **Kontekst Klucza**

${groupReferenceString}
${historyContextString}
${globalContextString}

**Kontekst Klucza:** "${context}"

**ABSOLUTNE ŹRÓDŁO PRAWDY (POLSKI - ${polishTranslation.lang}):**
"${polishTranslation.value}"

**DODATKOWY PUNKT ODNIESIENIA (ANGIELSKI - ${englishTranslation?.lang || 'N/A'}):**
"${englishTranslation?.value || 'N/A'}"

**Zadanie:**
Dla każdego tłumaczenia z listy poniżej, wykonaj rygorystyczną ocenę, ściśle trzymając się podanych instrukcji.

**W swojej ocenie, dla każdego języka:**
1.  **'evaluation'**: Użyj jednej z wartości: 'Good', 'Needs Improvement', lub 'Incorrect'.
2.  **'feedback'**: Napisz zwięzłą i szczegółową opinię w języku polskim, która uzasadnia Twoją ocenę. Użyj podstawowego markdownu.
3.  **'suggestion'**: Jeśli ocena to 'Needs Improvement' lub 'Incorrect', podaj **TYLKO I WYŁĄCZNIE sugerowany tekst tłumaczenia**. Jeśli tłumaczenie jest 'Good', pomiń pole 'suggestion'.

**Tłumaczenia do oceny:**
${translationsString}

Zwróć odpowiedź w ustrukturyzowanym formacie JSON, zgodnie z podanym schematem. Odpowiedź musi zawierać tylko jeden element w tablicy 'analysis' dla języka docelowego.`;

    return prompt;
};


export const analyzeTranslations = async (
  translationKey: string,
  context: string,
  polishTranslation: { lang: string; value: string },
  englishTranslation: { lang:string; value: string } | null,
  translationsToReview: { lang: string; value: string }[],
  translationHistory: TranslationHistory,
  groupReferenceTranslations?: { key: string; translations: { lang: string; value: string }[] }[],
  globalContext?: string,
): Promise<AIAnalysisResult> => {
  
  const prompt = buildAnalysisPrompt(
    translationKey, context, polishTranslation, englishTranslation, translationsToReview,
    translationHistory, groupReferenceTranslations, globalContext
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
  history: TranslationHistory,
  globalContext: string
): string => {
  const translationsString = translations
    .map(t => `- Language: ${t.lang}, Translation: "${t.value}"`)
    .join('\n');

  let historyContextString = "";
  if (history && history[translationKey]) {
      const keyHistory = history[translationKey];
      const historyEntries = Object.entries(keyHistory)
      .map(([lang, value]) => `- Język '${lang}': zatwierdzona wersja to "${value}".`)
      .join('\n');
      
      if (historyEntries) {
      historyContextString = `
**Historia Zmian (Dodatkowy Kontekst):**
Dla tego klucza, użytkownik wcześniej zatwierdził poniższe wersje, co może dać wskazówkę co do jego zastosowania:
${historyEntries}
`;
      }
  }

  let globalContextString = "";
  if (globalContext) {
      globalContextString = `
**Kontekst Globalny Aplikacji (Dodatkowy Kontekst):**
Poniżej znajduje się ogólny opis aplikacji, w której używany jest ten tekst:
"${globalContext}"
`;
  }

  const prompt = `Jesteś specjalistą od UX i lokalizacji. Twoim zadaniem jest stworzenie krótkiego, ale precyzyjnego opisu kontekstu dla klucza tłumaczenia w aplikacji. Opis musi być w języku polskim. Na podstawie nazwy klucza, jego istniejących wartości oraz dodatkowych informacji, opisz, gdzie i w jakim celu ten tekst może być używany w interfejsie użytkownika.

Klucz: "${translationKey}"

Istniejące Tłumaczenia:
${translationsString}
${globalContextString}
${historyContextString}

Sugerowany Kontekst (odpowiedz TYLKO I WYŁĄCZNIE sugerowanym tekstem opisu, bez żadnych dodatkowych wstępów, formatowania markdown, cudzysłowów czy nagłówków typu "Sugerowany Kontekst:"):`;
  
  return prompt;
};


export const generateContextForKey = async (
  translationKey: string,
  translations: { lang: string; value: string }[],
  history: TranslationHistory,
  globalContext: string
): Promise<string> => {
  
  const prompt = buildGenerateContextPrompt(translationKey, translations, history, globalContext);

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


const buildReviewPolishPrompt = (
    key: string,
    polishValue: string,
    englishValue: string,
    context: string,
    globalContext: string,
): string => {

    return `Jesteś ekspertem od polskiego copywritingu technicznego. Twoim zadaniem jest ocena jakości tłumaczenia **z języka angielskiego na polski**.

**Kontekst Globalny Aplikacji:**
${globalContext || "Brak"}

**Kontekst dla tego klucza:**
${context || "Brak"}

**Klucz:**
\`${key}\`

**Wartość Angielska (Referencja):**
"${englishValue}"

**Wartość Polska (do Oceny):**
"${polishValue}"

**Zadanie:**
Oceń polskie tłumaczenie pod kątem:
1.  **Poprawności gramatycznej i ortograficznej.**
2.  **Zgodności znaczeniowej z wersją angielską.**
3.  **Naturalności i płynności brzmienia (czy nie jest to "kalka" z angielskiego).**

**Format odpowiedzi:**
Zwróć odpowiedź jako pojedynczy obiekt JSON w tablicy 'analysis', zgodnie z podanym schematem. W polach 'feedback' i 'suggestion' używaj języka polskiego.
- **'evaluation'**: 'Good', 'Needs Improvement', lub 'Incorrect'.
- **'feedback'**: Zwięzłe uzasadnienie oceny.
- **'suggestion'**: Jeśli widzisz pole do poprawy, podaj **tylko i wyłącznie** sugerowany tekst. W przeciwnym razie pomiń to pole.
`;
};


export const analyzeKeyForLanguage = async (
    key: string,
    targetLang: string,
    allValues: Record<string, { lang: string, value: string }>,
    context: string,
    history: TranslationHistory,
    globalContext: string,
    referenceTranslations?: { key: string; translations: { lang: string; value: string }[] }[],
): Promise<AnalysisItem | null> => {
    
    const polishFile = Object.values(allValues).find(v => polishFileFinder({ name: v.lang }));
    if (!polishFile) throw new Error("Polish source file not found for analysis.");
    
    const englishFile = Object.values(allValues).find(v => v.lang.toLowerCase() === 'en' || v.lang.toLowerCase() === 'english');
    const targetFile = allValues[targetLang];

    if (!targetFile) return null;

    let prompt: string;
    
    if (polishFileFinder({ name: targetLang })) {
        // We are reviewing the Polish source itself
        prompt = buildReviewPolishPrompt(key, polishFile.value, englishFile?.value || '', context, globalContext);
    } else {
        // We are analyzing a target language against the Polish source
        prompt = buildAnalysisPrompt(
            key, context, polishFile, englishFile || null, [{ lang: targetFile.lang, value: targetFile.value }],
            history, referenceTranslations, globalContext
        );
    }

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
        const parsed = JSON.parse(cleanJsonText) as AIAnalysisResult;

        if (parsed.analysis && parsed.analysis.length > 0) {
            return parsed.analysis[0];
        }
        return null;

    } catch (error) {
        console.error(`Error analyzing key "${key}" for lang "${targetLang}":`, error);
        const errorMessage = String(error);
        if (errorMessage.toLowerCase().includes("api key not valid")) {
            throw new Error("AI analysis failed: The provided API key is not valid.");
        }
        // Return a structured error to be displayed in the UI
        return {
            language: targetLang,
            evaluation: 'Incorrect',
            feedback: `AI analysis failed. Error: ${errorMessage}`,
        };
    }
};
