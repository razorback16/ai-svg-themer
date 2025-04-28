# SVG Themer

SVG Themer is a web application that allows you to upload an SVG file and generate alternative color themes for it using OpenAI's API. The application extracts colors from the SVG, converts it to a PNG, and then uses the OpenAI API to generate new color themes based on the original design.

## Features

- Upload SVG files or use the provided sample
- Extract colors from SVG files
- Convert SVG to PNG with appropriate dimensions
- Generate alternative color themes using OpenAI's API
- Apply different themes to the SVG in real-time
- Preview color swatches for each theme

## How to Use

1. Open `index.html` in a web browser
2. Enter your OpenAI API key in the provided field
3. Either:
   - Upload an SVG file using the file input
   - Use the "Load sample directly" button to use the provided sample SVG
4. Wait for the themes to be generated
5. Click on any theme card to apply it to the SVG
6. Download the sample SVG if you want to experiment with it

## Technical Details

- The application is built using vanilla HTML, CSS, and JavaScript
- SVG to PNG conversion is done client-side using Canvas
- Color extraction is performed using regex to find color attributes in the SVG
- The OpenAI API is called with the PNG image and extracted colors to generate themes
- Themes are applied by replacing color values in the SVG DOM

## API Usage

The application uses the OpenAI API to generate alternative color themes. You need to provide your own API key to use this feature. The API key is only stored in memory and is not saved anywhere.

## Files

- `index.html`: The main HTML file
- `style.css`: Styles for the application
- `script.js`: JavaScript code for the application logic
- `sample.svg`: A sample SVG file for testing

## Security Note

This application handles the OpenAI API key client-side for demonstration purposes. In a production environment, API requests should be proxied through a secure backend to protect API keys.

## License

This project is open source and available for personal and educational use.
