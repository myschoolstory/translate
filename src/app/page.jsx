"use client";
import React from "react";

import { useUpload } from "../utilities/runtime-helpers";

function MainComponent() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("es");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [originalFileType, setOriginalFileType] = useState("");
  const languages = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
  };
  const [upload, { loading: uploadLoading }] = useUpload();
  const [file, setFile] = useState(null);

  const handleTranslate = async () => {
    if (!input.trim() && !file) {
      setError("Please enter text or upload a file to translate");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let textToTranslate = input;

      if (file) {
        const { url: uploadedUrl, error: uploadError } = await upload({ file });
        if (uploadError) {
          setError(uploadError);
          return;
        }

        setOriginalFileType(file.type);

        const formData = new FormData();
        formData.append("inputFile", file);
        formData.append("outputType", "txt");

        const convertResponse = await fetch(
          "/integrations/file-converter/convert",
          {
            method: "POST",
            body: formData,
          }
        );

        textToTranslate = await convertResponse.text();
      }

      const moderationResponse = await fetch("/integrations/text-moderation/", {
        method: "POST",
        body: JSON.stringify({ input: textToTranslate }),
        headers: { "Content-Type": "application/json" },
      });
      const moderationData = await moderationResponse.json();

      if (moderationData.results[0].flagged) {
        setError(
          "This text contains inappropriate content and cannot be translated"
        );
        setLoading(false);
        return;
      }

      const response = await fetch(
        "/integrations/google-translate/language/translate/v2",
        {
          method: "POST",
          body: new URLSearchParams({
            q: textToTranslate,
            source: sourceLang,
            target: targetLang,
          }),
        }
      );
      const data = await response.json();

      if (file && originalFileType) {
        const formData = new FormData();
        const translatedTextBlob = new Blob(
          [data.data.translations[0].translatedText],
          { type: "text/plain" }
        );
        formData.append("inputFile", translatedTextBlob, "translated.txt");
        formData.append("outputType", originalFileType.split("/")[1]);

        const convertBackResponse = await fetch(
          "/integrations/file-converter/convert",
          {
            method: "POST",
            body: formData,
          }
        );

        const convertedFile = await convertBackResponse.blob();
        const fileUrl = URL.createObjectURL(convertedFile);
        setOutput(fileUrl);
      } else {
        setOutput(data.data.translations[0].translatedText);
      }
    } catch (err) {
      setError("Translation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8 font-roboto">
          Free Document Translation
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-6">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full md:w-64 p-2 border rounded-lg"
                name="source-language"
              >
                {Object.entries(languages).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-center">
                <i className="fas fa-exchange-alt text-gray-400"></i>
              </div>

              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full md:w-64 p-2 border rounded-lg"
                name="target-language"
              >
                {Object.entries(languages).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full h-40 p-4 border rounded-lg"
                placeholder="Enter text to translate..."
                name="input-text"
              />

              <div className="flex items-center justify-center w-full">
                <label className="w-full flex flex-col items-center px-4 py-6 bg-white rounded-lg border-2 border-dashed cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center">
                    <i className="fas fa-cloud-upload-alt text-gray-500 text-xl mr-2"></i>
                    <span className="text-gray-500">Upload a file</span>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".txt,.pdf,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0])}
                    name="document"
                  />
                  {file && (
                    <p className="mt-2 text-sm text-gray-500">{file.name}</p>
                  )}
                </label>
              </div>
            </div>
          </div>

          {error && <div className="text-red-500 mb-4">{error}</div>}

          <button
            onClick={handleTranslate}
            disabled={loading || uploadLoading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors w-full md:w-auto"
          >
            {loading || uploadLoading ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              "Translate"
            )}
          </button>

          {output && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4 font-roboto">
                Translation:
              </h2>
              <div className="p-4 bg-gray-50 rounded-lg border whitespace-pre-wrap">
                {output}
              </div>
              <button
                onClick={() => {
                  const blob = new Blob([output], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `translated_${file ? file.name : "text.txt"}`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <i className="fas fa-download mr-2"></i>
                Download Translation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MainComponent;