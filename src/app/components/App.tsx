'use client';

import React, { useState } from 'react';
import FileUpload from './FileUpload';
import LoadingSpinner from '../components/LoadingSpinner';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

function App() {
    const router = useRouter();

    const [ingredientInput, setIngredientInput] = useState('');
    //const [ingredientsFromFile, setIngredientsFromFile] = useState<string[]>([]);
    const [results, setResults] = useState<{ [ingredient: string]: any[] }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const findSubstitutes = async (ingredients: string[]) => {
        setLoading(true);
        setResults({});
        setError(null);

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || 'AIzaSyCZapeS_oM6WS-YYuFgJmXVLP24ILvsj0U';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const allResults: { [ingredient: string]: any[] } = {};

        for (const ingredient of ingredients) {
            let prompt = `For the ingredient '${ingredient}', suggest 1–3 suitable substitutes.`;
            prompt += ` For each suggestion, return:\n- 'substitute'\n- 'score' (0–100 relevance)\n- 'reason'\n- 'cuisine_context' (optional)\n- 'allergen_info' (e.g. dairy, nuts)\n- 'historical_notes' (brief food history). Return the output as a JSON array.`;

            const payload = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                substitute: { type: 'STRING' },
                                score: { type: 'NUMBER' },
                                reason: { type: 'STRING' },
                                cuisine_context: { type: 'STRING' },
                                allergen_info: { type: 'STRING' },
                                historical_notes: { type: 'STRING' },
                            },
                            required: ['substitute', 'score', 'reason'],
                        },
                    },
                },
            };

            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                const data = await res.json();
                const jsonString = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                const parsed = JSON.parse(jsonString);
                allResults[ingredient] = parsed;
            } catch (err: any) {
                setError(`Error for ingredient "${ingredient}": ${err.message}`);
            }
        }

        setResults(allResults);
        setLoading(false);
    };

    const handleFileSelected = async (file: File) => {
        const text = await file.text();
        try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
                throw new Error('Invalid format: Expected a JSON array of strings.');
            }
            setIngredientsFromFile(parsed);
            findSubstitutes(parsed);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleTextSearch = () => {
        const trimmed = ingredientInput.trim();
        if (trimmed) {
            findSubstitutes([trimmed]);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-6 font-sans">
            <div className="flex justify-between items-center w-full max-w-2xl mb-4">
                <h1 className="text-4xl font-bold text-indigo-700">Smart Swap</h1>
                <button
                    onClick={handleLogout}
                    className="text-sm bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                    Logout
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 w-full max-w-2xl">
                <label className="block text-sm font-semibold mb-2">Ingredient to Substitute:</label>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={ingredientInput}
                        onChange={(e) => setIngredientInput(e.target.value)}
                        className="flex-1 border border-gray-300 rounded px-4 py-2"
                        placeholder="e.g., Butter"
                        disabled={loading}
                    />
                    <button
                        onClick={handleTextSearch}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        disabled={loading || !ingredientInput.trim()}
                    >
                        Submit
                    </button>
                </div>

                <div className="my-6">
                    <label className="block text-sm font-semibold mb-2">Or upload a JSON file:</label>
                    <FileUpload onFileSelected={handleFileSelected} onError={setError} />
                </div>
            </div>

            {loading && (
                <div className="mt-6">
                    <LoadingSpinner size="w-12 h-12" />
                    <p className="text-gray-600 mt-2">Finding substitutes...</p>
                </div>
            )}

            {error && (
                <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded w-full max-w-xl">
                    {error}
                </div>
            )}

            {!loading && Object.keys(results).length > 0 && (
                <div className="mt-8 w-full max-w-3xl space-y-6">
                    {Object.entries(results).map(([ingredient, subs]) => (
                        <div key={ingredient} className="mb-4 p-3 border-l-4 border-blue-500 bg-blue-50 rounded">
                            <h2 className="font-semibold mb-2">Substitutes for <span className="text-indigo-700">{ingredient}</span>:</h2>
                            {Array.isArray(subs) && subs.map((item, subIdx) => (
                                <div key={subIdx} className="mb-2 pl-2">
                                    <p><strong>{item.substitute}</strong> — Score: {item.score}/100</p>
                                    <p className="text-sm text-gray-700">{item.reason}</p>
                                    {item.cuisine_context && (
                                        <p className="text-sm text-gray-600">Cuisine: {item.cuisine_context}</p>
                                    )}
                                    {item.allergen_info && (
                                        <p className="text-sm text-red-600">Allergen Info: {item.allergen_info}</p>
                                    )}
                                    {item.historical_notes && (
                                        <p className="text-sm text-gray-600 italic">History: {item.historical_notes}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default App;
