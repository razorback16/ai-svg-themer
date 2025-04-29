document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const svgFileInput = document.getElementById('svgFile');
    const apiKeyInput = document.getElementById('apiKey');
    const modelSelector = document.getElementById('modelSelector');
    const svgDisplay = document.getElementById('svgDisplay');
    const themeSelector = document.getElementById('themeSelector');
    const statusElement = document.getElementById('status');
    const loadSampleButton = document.getElementById('loadSample');

    // Global variables
    let originalSvgText = '';
    let originalSvgDOM = null;
    let extractedColors = [];

    // Event Listeners
    svgFileInput.addEventListener('change', handleFileUpload);
    loadSampleButton.addEventListener('click', loadSampleSvg);

    // Functions
    function updateStatus(message, isError = false) {
        statusElement.textContent = message;
        statusElement.style.color = isError ? '#d9534f' : '#333';
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check if file is SVG
        if (!file.type.includes('svg')) {
            updateStatus('Please upload an SVG file.', true);
            return;
        }

        try {
            updateStatus('Reading SVG file...');
            
            // Read the file
            const svgText = await readFileAsText(file);
            originalSvgText = svgText;
            
            // Display the SVG
            displaySvg(svgText);
            
            // Extract colors
            updateStatus('Extracting colors...');
            extractedColors = extractColorsFromSvg(svgText);
            
            // Convert to PNG
            updateStatus('Converting to PNG...');
            const pngBase64 = await convertSvgToPng(svgText);
            
            // Check if API key is provided
            const apiKey = apiKeyInput.value.trim();
            const selectedModel = modelSelector.value;
            let themes;
            
            if (!apiKey) {
                updateStatus('No API key provided. Using sample themes...');
                themes = getMockThemes(extractedColors);
            } else {
                // Call the appropriate API based on the selected model
                if (selectedModel === 'openai') {
                    updateStatus('Generating themes with OpenAI API...');
                    themes = await callOpenAIAPI(pngBase64, extractedColors, apiKey);
                } else if (selectedModel === 'gemini') {
                    updateStatus('Generating themes with Gemini API...');
                    themes = await callGeminiAPI(pngBase64, extractedColors, apiKey);
                }
            }
            
            // Display themes
            displayThemes(themes);
            
            updateStatus('Ready! Select a theme to apply.');
        } catch (error) {
            console.error('Error:', error);
            updateStatus(`Error: ${error.message}`, true);
        }
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    function displaySvg(svgText) {
        // Parse SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        originalSvgDOM = svgDoc.documentElement.cloneNode(true);
        
        // Clear display and add SVG
        svgDisplay.innerHTML = '';
        svgDisplay.appendChild(svgDoc.documentElement);
    }

    function extractColorsFromSvg(svgText) {
        const colorSet = new Set();
        
        // Extract fill colors
        const fillRegex = /fill="(#[0-9A-Fa-f]{3,8})"/g;
        let match;
        while ((match = fillRegex.exec(svgText)) !== null) {
            colorSet.add(match[1]);
        }
        
        // Extract stroke colors
        const strokeRegex = /stroke="(#[0-9A-Fa-f]{3,8})"/g;
        while ((match = strokeRegex.exec(svgText)) !== null) {
            colorSet.add(match[1]);
        }
        
        // Extract stop-color for gradients
        const stopColorRegex = /stop-color="(#[0-9A-Fa-f]{3,8})"/g;
        while ((match = stopColorRegex.exec(svgText)) !== null) {
            colorSet.add(match[1]);
        }
        
        // Extract style with color
        const styleColorRegex = /style="[^"]*(?:fill|stroke|stop-color):\s*(#[0-9A-Fa-f]{3,8})/g;
        while ((match = styleColorRegex.exec(svgText)) !== null) {
            colorSet.add(match[1]);
        }
        
        return Array.from(colorSet);
    }

    function convertSvgToPng(svgText) {
        return new Promise((resolve, reject) => {
            // Create an image element
            const img = new Image();
            
            // Set up image load handler
            img.onload = () => {
                // Create canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate dimensions (max 1024px for larger side)
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > 1024) {
                        height = Math.round(height * (1024 / width));
                        width = 1024;
                    }
                } else {
                    if (height > 1024) {
                        width = Math.round(width * (1024 / height));
                        height = 1024;
                    }
                }
                
                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;
                
                // Draw image to canvas
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to PNG
                const pngDataUrl = canvas.toDataURL('image/png');
                
                // Extract base64 part
                const base64Data = pngDataUrl.split(',')[1];
                resolve(base64Data);
            };
            
            // Handle errors
            img.onerror = () => {
                reject(new Error('Failed to convert SVG to PNG'));
            };
            
            // Set image source to SVG data URL
            const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(svgBlob);
            img.src = url;
        });
    }

    async function callOpenAIAPI(pngBase64, colors, apiKey) {
        console.log('Calling OpenAI API with colors:', colors);
        
        // Construct the request body
        const requestBody = {
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "system",
                    content: [
                        {
                            type: "input_text",
                            text: "Generate alternative color themes based on an SVG image's existing colors. The input will include the image and a list of all colors with their IDs.\n\n# Input Format\n- SVG Image\n- Color List: [ hex: string, ...]\n\n# Analysis Steps\n\n1. IMAGE CONTEXT\n- Analyze image content and purpose\n- Identify design style and intended mood\n- Note color relationships and hierarchy\n\n2. COLOR CATEGORIZATION\n- Categorize provided colors by their roles:\n  • Main/Brand colors\n  • Background colors\n  • Text/Content colors\n  • Decorative/Accent colors\n  • Interactive elements\n- Note color relationships and usage patterns\n\n3. THEME GENERATION\n- Create alternative themes preserving:\n  • Color relationships\n  • Visual hierarchy\n  • Functional contrast\n  • Original design intent\n- Each theme should provide new hex values for all original color IDs\n\n# Output Format\n\n## 1. Analysis\n\n### Image Context:\n\n\"Brief description\",\n\"Design style\",\n\"Intended mood\",\n\n### Color Analysis:\n\n#### color_roles\n\n      1. main_colors roles\n      2. background_colors roles\n      3. content_colors roles\n      4. accent_colors roles\n      5. interactive_colors roles\n\n\n## 2. Themes\n\n```json\n{\n  \"themes\": [\n    {\n      \"name\": \"Theme name\",\n      \"description\": \"Theme description\",\n      \"mood\": \"Intended mood\",\n      \"colors\": [\n        {\n          \"role\": \"color role\"\n          \"original\": \"#XXXXXX\",\n          \"new\": \"#XXXXXX\",\n        },\n        ...\n      ]\n    },\n    ...\n  ]\n}\n```\n\n# Guidelines\n\n- Maintain sufficient contrast ratios\n- Preserve visual hierarchy\n- Consider color accessibility\n- Keep color relationships consistent\n- Respect brand color guidelines if present\n- Account for different color roles (UI elements, text, backgrounds)\n\n# Theme Diversity Requirements\n\n- Generate 5 - 10 diverse themes with different aesthetic styles and moods\n- Themes should represent a range of different color approaches, such as:\n  • Contrasting color schemes (e.g., light/dark, complementary colors)\n  • Different color temperatures (e.g., warm, cool, neutral)\n  • Various aesthetic styles (e.g., minimalist, vibrant, muted, professional)\n  • Different emotional tones (e.g., energetic, calm, playful, serious)\n- Adapt themes to be appropriate for the specific content and purpose of the SVG\n- Each theme should have a distinct visual identity while maintaining the functional purpose of the original design\n- Consider the subject matter of the SVG when generating themes (e.g., nature-inspired themes for natural scenes, tech-oriented themes for UI elements)\n\n# Notes\n\n- Number of themes and categorization should be determined by image context\n- Color roles should be inferred from usage patterns\n- Generated themes should maintain functional clarity\n- Consider cultural and psychological color implications\n- Final Theme JSON should be accurate so that can be parsed by code"
                        }
                    ]
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_image",
                            image_url: `data:image/png;base64,${pngBase64}`
                        },
                        {
                            type: "input_text",
                            text: `Color List: ${JSON.stringify(colors)}`
                        }
                    ]
                }
            ],
            text: {
                format: {
                    type: "text"
                }
            },
            reasoning: {},
            tools: [],
            temperature: 1,
            max_output_tokens: 32768,
            top_p: 1,
            store: false
        };

        // Make the API call
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        // Log the response data for debugging
        console.log('API Response:', data);
        
        let responseText = '';
        
        // Handle different API response structures
        if (data.output && Array.isArray(data.output)) {
            // New API format
            console.log('Detected new API format with output array');
            const assistantMessage = data.output.find(item => item.role === 'assistant');
            if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
                responseText = assistantMessage.content[0].text;
            }
        } else {
            console.error('Unexpected API response structure:', data);
            throw new Error('Unexpected API response structure. Check console for details.');
        }
        
        if (!responseText) {
            console.error('No response text found in API response');
            throw new Error('No response text found in API result');
        }
        
        console.log('Response text:', responseText);
        
        // Extract JSON from the response text
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (!jsonMatch) {
            console.error('No JSON found in response text:', responseText);
            throw new Error('No JSON found in API response');
        }
        
        try {
            const jsonText = jsonMatch[1];
            console.log('Extracted JSON:', jsonText);
            const themesData = JSON.parse(jsonText);
            return themesData.themes;
        } catch (error) {
            console.error('Failed to parse JSON:', error, jsonMatch[1]);
            throw new Error('Failed to parse themes JSON from API response');
        }
    }

    function displayThemes(themes) {
        // Clear previous themes
        themeSelector.innerHTML = '';
        
        // Create a card for each theme
        themes.forEach(theme => {
            const themeCard = document.createElement('div');
            themeCard.className = 'theme-card';
            
            // Theme name
            const nameElement = document.createElement('h3');
            nameElement.textContent = theme.name;
            themeCard.appendChild(nameElement);
            
            // Theme description
            const descElement = document.createElement('p');
            descElement.textContent = theme.description;
            themeCard.appendChild(descElement);
            
            // Theme mood
            const moodElement = document.createElement('p');
            moodElement.innerHTML = `<strong>Mood:</strong> ${theme.mood}`;
            themeCard.appendChild(moodElement);
            
            // Color preview
            const colorPreview = document.createElement('div');
            colorPreview.className = 'color-preview';
            
            // Add color swatches
            theme.colors.forEach(color => {
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch';
                swatch.style.backgroundColor = color.new;
                swatch.title = `${color.role}: ${color.original} → ${color.new}`;
                colorPreview.appendChild(swatch);
            });
            
            themeCard.appendChild(colorPreview);
            
            // Add click event to apply theme
            themeCard.addEventListener('click', () => applyTheme(theme));
            
            // Add to theme selector
            themeSelector.appendChild(themeCard);
        });
    }

    async function callGeminiAPI(pngBase64, colors, apiKey) {
        console.log('Calling Gemini API with colors:', colors);
        
        // Construct the request body
        const requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: "Generate alternative color themes based on an SVG image's existing colors. The input will include the image and a list of all colors with their IDs.\n\n# Input Format\n- SVG Image\n- Color List: [ hex: string, ...]\n\n# Analysis Steps\n\n1. IMAGE CONTEXT\n- Analyze image content and purpose\n- Identify design style and intended mood\n- Note color relationships and hierarchy\n\n2. COLOR CATEGORIZATION\n- Categorize provided colors by their roles:\n  • Main/Brand colors\n  • Background colors\n  • Text/Content colors\n  • Decorative/Accent colors\n  • Interactive elements\n- Note color relationships and usage patterns\n\n3. THEME GENERATION\n- Create alternative themes preserving:\n  • Color relationships\n  • Visual hierarchy\n  • Functional contrast\n  • Original design intent\n- Each theme should provide new hex values for all original color IDs\n\n# Output Format\n\n## 1. Analysis\n\n### Image Context:\n\n\"Brief description\",\n\"Design style\",\n\"Intended mood\",\n\n### Color Analysis:\n\n#### color_roles\n\n      1. main_colors roles\n      2. background_colors roles\n      3. content_colors roles\n      4. accent_colors roles\n      5. interactive_colors roles\n\n\n## 2. Themes\n\n```json\n{\n  \"themes\": [\n    {\n      \"name\": \"Theme name\",\n      \"description\": \"Theme description\",\n      \"mood\": \"Intended mood\",\n      \"colors\": [\n        {\n          \"role\": \"color role\"\n          \"original\": \"#XXXXXX\",\n          \"new\": \"#XXXXXX\",\n        },\n        ...\n      ]\n    },\n    ...\n  ]\n}\n```\n\n# Guidelines\n\n- Maintain sufficient contrast ratios\n- Preserve visual hierarchy\n- Consider color accessibility\n- Keep color relationships consistent\n- Respect brand color guidelines if present\n- Account for different color roles (UI elements, text, backgrounds)\n\n# Theme Diversity Requirements\n\n- Generate 5 - 10 diverse themes with different aesthetic styles and moods\n- Themes should represent a range of different color approaches, such as:\n  • Contrasting color schemes (e.g., light/dark, complementary colors)\n  • Different color temperatures (e.g., warm, cool, neutral)\n  • Various aesthetic styles (e.g., minimalist, vibrant, muted, professional)\n  • Different emotional tones (e.g., energetic, calm, playful, serious)\n- Adapt themes to be appropriate for the specific content and purpose of the SVG\n- Each theme should have a distinct visual identity while maintaining the functional purpose of the original design\n- Consider the subject matter of the SVG when generating themes (e.g., nature-inspired themes for natural scenes, tech-oriented themes for UI elements)\n\n# Notes\n\n- Number of themes and categorization should be determined by image context\n- Color roles should be inferred from usage patterns\n- Generated themes should maintain functional clarity\n- Consider cultural and psychological color implications\n- Final Theme JSON should be accurate so that can be parsed by code"
                        },
                        {
                            inline_data: {
                                mime_type: "image/png",
                                data: pngBase64
                            }
                        },
                        {
                            text: `Color List: ${JSON.stringify(colors)}`
                        }
                    ]
                }
            ],
            generation_config: {
                temperature: 1.0,
                top_p: 0.95,
                top_k: 40,
                max_output_tokens: 32768,
            },
            model: "gemini-2.0-flash"
        };

        // Make the API call
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        // Log the response data for debugging
        console.log('API Response:', data);
        
        let responseText = '';
        
        // Handle Gemini API response structure
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
            responseText = data.candidates[0].content.parts[0].text;
        } else {
            console.error('Unexpected API response structure:', data);
            throw new Error('Unexpected API response structure. Check console for details.');
        }
        
        if (!responseText) {
            console.error('No response text found in API response');
            throw new Error('No response text found in API result');
        }
        
        console.log('Response text:', responseText);
        
        // Extract JSON from the response text
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (!jsonMatch) {
            console.error('No JSON found in response text:', responseText);
            throw new Error('No JSON found in API response');
        }
        
        try {
            const jsonText = jsonMatch[1];
            console.log('Extracted JSON:', jsonText);
            const themesData = JSON.parse(jsonText);
            return themesData.themes;
        } catch (error) {
            console.error('Failed to parse JSON:', error, jsonMatch[1]);
            throw new Error('Failed to parse themes JSON from API response');
        }
    }

    async function loadSampleSvg() {
        try {
            updateStatus('Loading sample SVG...');
            
            // Sample SVG embedded directly to avoid CORS issues
            const svgText = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="400" height="300" fill="#F7F4D4" />
  
  <!-- Sun -->
  <circle cx="320" cy="70" r="40" fill="#F58F30" />
  <circle cx="320" cy="70" r="30" fill="#EB3B4D" />
  
  <!-- Mountains -->
  <polygon points="0,300 150,100 300,250 400,180 400,300" fill="#2A3A7C" />
  <polygon points="0,300 100,200 200,250 300,220 400,280 400,300" fill="#4EB8A0" />
  
  <!-- Trees -->
  <g transform="translate(80, 200)">
    <rect x="-5" y="0" width="10" height="30" fill="#2D4C2A" />
    <polygon points="0,-40 -20,0 20,0" fill="#4EB8A0" />
    <polygon points="0,-60 -15,-20 15,-20" fill="#4EB8A0" />
    <polygon points="0,-75 -10,-40 10,-40" fill="#4EB8A0" />
  </g>
  
  <g transform="translate(150, 220)">
    <rect x="-6" y="0" width="12" height="25" fill="#2D4C2A" />
    <polygon points="0,-35 -25,0 25,0" fill="#638FC0" />
    <polygon points="0,-55 -20,-15 20,-15" fill="#638FC0" />
  </g>
  
  <g transform="translate(250, 210)">
    <rect x="-7" y="0" width="14" height="35" fill="#2D4C2A" />
    <polygon points="0,-50 -30,0 30,0" fill="#4EB8A0" />
    <polygon points="0,-75 -25,-25 25,-25" fill="#4EB8A0" />
    <polygon points="0,-95 -20,-50 20,-50" fill="#4EB8A0" />
  </g>
  
  <!-- Bird -->
  <g transform="translate(100, 100)">
    <path d="M0,0 C5,-10 15,-10 20,0 C25,-10 35,-10 40,0" stroke="#000000" stroke-width="3" fill="none" />
  </g>
  
  <!-- Cloud -->
  <g transform="translate(180, 60)">
    <ellipse cx="0" cy="0" rx="30" ry="20" fill="#F7F4D4" stroke="#638FC0" stroke-width="2" />
    <ellipse cx="25" cy="-5" rx="25" ry="15" fill="#F7F4D4" stroke="#638FC0" stroke-width="2" />
    <ellipse cx="-25" cy="5" rx="20" ry="15" fill="#F7F4D4" stroke="#638FC0" stroke-width="2" />
  </g>
</svg>`;
            
            originalSvgText = svgText;
            
            // Display the SVG
            displaySvg(svgText);
            
            // Extract colors
            updateStatus('Extracting colors...');
            extractedColors = extractColorsFromSvg(svgText);
            
            // Convert to PNG
            updateStatus('Converting to PNG...');
            const pngBase64 = await convertSvgToPng(svgText);
            
            // Check if API key is provided
            const apiKey = apiKeyInput.value.trim();
            const selectedModel = modelSelector.value;
            let themes;
            
            if (!apiKey) {
                updateStatus('No API key provided. Using sample themes...');
                themes = getMockThemes(extractedColors);
            } else {
                // Call the appropriate API based on the selected model
                if (selectedModel === 'openai') {
                    updateStatus('Generating themes with OpenAI API...');
                    themes = await callOpenAIAPI(pngBase64, extractedColors, apiKey);
                } else if (selectedModel === 'gemini') {
                    updateStatus('Generating themes with Gemini API...');
                    themes = await callGeminiAPI(pngBase64, extractedColors, apiKey);
                }
            }
            
            // Display themes
            displayThemes(themes);
            
            updateStatus('Ready! Select a theme to apply.');
        } catch (error) {
            console.error('Error:', error);
            updateStatus(`Error: ${error.message}`, true);
        }
    }

    function getMockThemes(colors) {
        console.log('Generating mock themes for colors:', colors);
        
        // Create three sample themes with different color schemes
        return [
            {
                name: "Cool Blues",
                description: "A calming blue palette with cool tones",
                mood: "Calm, peaceful, serene",
                colors: colors.map(color => {
                    // Create a mapping for each original color to a new blue-tinted color
                    return {
                        role: getColorRole(color),
                        original: color,
                        new: shiftToBlue(color)
                    };
                })
            },
            {
                name: "Warm Sunset",
                description: "A warm palette inspired by sunset colors",
                mood: "Warm, inviting, energetic",
                colors: colors.map(color => {
                    return {
                        role: getColorRole(color),
                        original: color,
                        new: shiftToWarm(color)
                    };
                })
            },
            {
                name: "Monochrome",
                description: "A grayscale palette with subtle tones",
                mood: "Elegant, classic, focused",
                colors: colors.map(color => {
                    return {
                        role: getColorRole(color),
                        original: color,
                        new: convertToGrayscale(color)
                    };
                })
            }
        ];
    }
    
    // Helper functions for mock themes
    function getColorRole(color) {
        // Assign a role based on the color
        const colorLower = color.toLowerCase();
        
        // Background colors are typically light
        if (isLightColor(colorLower)) {
            return "Background";
        }
        
        // Common accent colors
        if (colorLower === "#f58f30" || colorLower === "#eb3b4d") {
            return "Accent";
        }
        
        // Blues are often used for content
        if (colorLower === "#2a3a7c" || colorLower === "#638fc0") {
            return "Content";
        }
        
        // Greens are often used for nature elements
        if (colorLower === "#4eb8a0" || colorLower === "#2d4c2a") {
            return "Nature";
        }
        
        // Default role
        return "General";
    }
    
    function isLightColor(hexColor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substring(1, 3), 16);
        const g = parseInt(hexColor.substring(3, 5), 16);
        const b = parseInt(hexColor.substring(5, 7), 16);
        
        // Calculate perceived brightness (YIQ formula)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        
        // Return true if the color is light
        return brightness > 128;
    }
    
    function shiftToBlue(hexColor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substring(1, 3), 16);
        const g = parseInt(hexColor.substring(3, 5), 16);
        const b = parseInt(hexColor.substring(5, 7), 16);
        
        // Shift towards blue
        const newR = Math.max(0, Math.min(255, r * 0.7));
        const newG = Math.max(0, Math.min(255, g * 0.9));
        const newB = Math.max(0, Math.min(255, b * 1.2));
        
        // Convert back to hex
        return `#${Math.round(newR).toString(16).padStart(2, '0')}${Math.round(newG).toString(16).padStart(2, '0')}${Math.round(newB).toString(16).padStart(2, '0')}`;
    }
    
    function shiftToWarm(hexColor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substring(1, 3), 16);
        const g = parseInt(hexColor.substring(3, 5), 16);
        const b = parseInt(hexColor.substring(5, 7), 16);
        
        // Shift towards warm colors (more red and yellow)
        const newR = Math.max(0, Math.min(255, r * 1.2));
        const newG = Math.max(0, Math.min(255, g * 1.1));
        const newB = Math.max(0, Math.min(255, b * 0.8));
        
        // Convert back to hex
        return `#${Math.round(newR).toString(16).padStart(2, '0')}${Math.round(newG).toString(16).padStart(2, '0')}${Math.round(newB).toString(16).padStart(2, '0')}`;
    }
    
    function convertToGrayscale(hexColor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substring(1, 3), 16);
        const g = parseInt(hexColor.substring(3, 5), 16);
        const b = parseInt(hexColor.substring(5, 7), 16);
        
        // Convert to grayscale using luminance formula
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        
        // Convert back to hex
        const grayHex = gray.toString(16).padStart(2, '0');
        return `#${grayHex}${grayHex}${grayHex}`;
    }
    
    function applyTheme(theme) {
        // Clone the original SVG DOM
        const svgClone = originalSvgDOM.cloneNode(true);
        
        // Create a color mapping for quick lookup
        const colorMap = {};
        theme.colors.forEach(color => {
            colorMap[color.original.toLowerCase()] = color.new;
        });
        
        // Function to replace colors in attributes
        function replaceColors(element) {
            // Replace fill attribute
            if (element.hasAttribute('fill')) {
                const fill = element.getAttribute('fill').toLowerCase();
                if (colorMap[fill]) {
                    element.setAttribute('fill', colorMap[fill]);
                }
            }
            
            // Replace stroke attribute
            if (element.hasAttribute('stroke')) {
                const stroke = element.getAttribute('stroke').toLowerCase();
                if (colorMap[stroke]) {
                    element.setAttribute('stroke', colorMap[stroke]);
                }
            }
            
            // Replace stop-color attribute
            if (element.hasAttribute('stop-color')) {
                const stopColor = element.getAttribute('stop-color').toLowerCase();
                if (colorMap[stopColor]) {
                    element.setAttribute('stop-color', colorMap[stopColor]);
                }
            }
            
            // Replace colors in style attribute
            if (element.hasAttribute('style')) {
                let style = element.getAttribute('style');
                
                // Replace fill in style
                style = style.replace(/(fill:\s*)(#[0-9A-Fa-f]{3,8})/gi, (match, prefix, color) => {
                    return colorMap[color.toLowerCase()] ? `${prefix}${colorMap[color.toLowerCase()]}` : match;
                });
                
                // Replace stroke in style
                style = style.replace(/(stroke:\s*)(#[0-9A-Fa-f]{3,8})/gi, (match, prefix, color) => {
                    return colorMap[color.toLowerCase()] ? `${prefix}${colorMap[color.toLowerCase()]}` : match;
                });
                
                // Replace stop-color in style
                style = style.replace(/(stop-color:\s*)(#[0-9A-Fa-f]{3,8})/gi, (match, prefix, color) => {
                    return colorMap[color.toLowerCase()] ? `${prefix}${colorMap[color.toLowerCase()]}` : match;
                });
                
                element.setAttribute('style', style);
            }
            
            // Process child elements recursively
            Array.from(element.children).forEach(child => replaceColors(child));
        }
        
        // Apply color replacements
        replaceColors(svgClone);
        
        // Update the display
        svgDisplay.innerHTML = '';
        svgDisplay.appendChild(svgClone);
        
        updateStatus(`Applied theme: ${theme.name}`);
    }
});
