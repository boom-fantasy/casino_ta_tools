#target photoshop

// Add function to prompt for dimensions
function promptForDocumentSize() {
    // Create dialog
    var dlg = new Window("dialog", "Document Size");
    dlg.orientation = "column";
    
    // Add width input group
    var widthGroup = dlg.add("group");
    widthGroup.add("statictext", undefined, "Width (px):");
    var widthInput = widthGroup.add("edittext", undefined, "1920");
    widthInput.characters = 6;
    
    // Add height input group
    var heightGroup = dlg.add("group");
    heightGroup.add("statictext", undefined, "Height (px):");
    var heightInput = heightGroup.add("edittext", undefined, "1080");
    heightInput.characters = 6;
    
    // Add 2x checkbox
    var scaleGroup = dlg.add("group");
    var scale2x = scaleGroup.add("checkbox", undefined, "Create Smart Objects at 2x Resolution");
    
    // Add buttons
    var btnGroup = dlg.add("group");
    btnGroup.add("button", undefined, "OK");
    btnGroup.add("button", undefined, "Cancel");
    
    // Show dialog and return results
    if (dlg.show() == 1) {
        return {
            width: parseInt(widthInput.text),
            height: parseInt(heightInput.text),
            scale2x: scale2x.value
        };
    }
    return null;
}

function createPhotoshopDocument(docWidth, docHeight, scale2x) {
    // Open file dialog to choose CSV
    var csvFile = File.openDialog("Select a CSV file", "*.csv");
    if (csvFile === null) {
        alert("No file selected. Script terminated.");
        return;
    }

    // Create the main document
    var doc = app.documents.add(docWidth, docHeight);

    // Read and parse the CSV file
    csvFile.open('r');
    var csvContent = csvFile.read();
    csvFile.close();

    function parseCSV(csvText) {
        var rows = [];
        var currentRow = [];
        var currentValue = '';
        var inQuotes = false;
        
        for (var i = 0; i < csvText.length; i++) {
            var currentChar = csvText.charAt(i);
            var nextChar = csvText.charAt(i + 1);
            
            if (currentChar === '"') {
                if (nextChar === '"') {
                    // Handle escaped quotes
                    currentValue += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (currentChar === ',' && !inQuotes) {
                // End of field
                currentRow.push(String(currentValue).replace(/^\s+|\s+$/g, ''));
                currentValue = '';
            } else if ((currentChar === '\n' || currentChar === '\r') && !inQuotes) {
                // End of row - but only if we're not in quotes
                if (currentValue) {
                    currentRow.push(String(currentValue).replace(/^\s+|\s+$/g, ''));
                    currentValue = '';
                }
                if (currentRow.length > 0) {
                    rows.push(currentRow);
                    currentRow = [];
                }
                // Skip \r\n
                if (currentChar === '\r' && nextChar === '\n') {
                    i++;
                }
            } else {
                currentValue += currentChar;
            }
        }
        
        // Handle last value and row
        if (currentValue) {
            currentRow.push(String(currentValue).replace(/^\s+|\s+$/g, ''));
        }
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }
        
        return rows;
    }

    // Parse the CSV content
    var parsedRows = parseCSV(csvContent);
    var headers = parsedRows[0];

    // Clean headers
    for (var h = 0; h < headers.length; h++) {
        headers[h] = String(headers[h]).replace(/^\s+|\s+$/g, '');
    }

    // Find column indices
    var columnIndices = {
        name: -1,
        width: -1,
        height: -1,
        x: -1,
        y: -1,
        folder: -1
    };

    // Define which columns are required
    var requiredColumns = ['name', 'width', 'height'];

    for (var i = 0; i < headers.length; i++) {
        var header = headers[i].toLowerCase();
        switch(header) {
            case 'delivery asset name': 
                columnIndices.name = i; 
                break;
            case 'width': 
                columnIndices.width = i;
                break;
            case 'height': 
                columnIndices.height = i;
                break;
            case 'x': columnIndices.x = i; break;
            case 'y': columnIndices.y = i; break;
            case 'folder': columnIndices.folder = i; break;
        }
    }

    // Get unique folder names from CSV
    var uniqueFolders = {};
    for (var i = 1; i < parsedRows.length; i++) {
        var values = parsedRows[i];
        if (columnIndices.folder !== -1 && values[columnIndices.folder]) {
            var folderName = String(values[columnIndices.folder]).toLowerCase().replace(/^\s+|\s+$/g, '');
            if (folderName) {
                uniqueFolders[folderName] = true;
            }
        } else {
            uniqueFolders['default'] = true;
        }
    }

    // Create folder structure
    var folders = {};
    for (var folder in uniqueFolders) {
        folders[folder] = doc.layerSets.add();
        folders[folder].name = folder.charAt(0).toUpperCase() + folder.slice(1);
    }

    var smartObjects = []; // Array to store smart object layers

    // Validate only required columns exist
    var missingColumns = [];
    for (var i = 0; i < requiredColumns.length; i++) {
        var col = requiredColumns[i];
        if (columnIndices[col] === -1) {
            missingColumns.push(col);
        }
    }
    
    if (missingColumns.length > 0) {
        alert("Missing required columns: " + missingColumns.join(", "));
        return;
    }

    // Then use the indices when processing rows
    for (var i = 1; i < parsedRows.length; i++) {
        var values = parsedRows[i];
        var layerName = values[columnIndices.name];
        var width = parseInt(values[columnIndices.width], 10) || 0;
        var height = parseInt(values[columnIndices.height], 10) || 0;
        var xPosition = columnIndices.x !== -1 ? parseInt(values[columnIndices.x], 10) || 0 : (docWidth - width) / 2;
        var yPosition = columnIndices.y !== -1 ? parseInt(values[columnIndices.y], 10) || 0 : (docHeight - height) / 2;
        var folderName = columnIndices.folder !== -1 ? 
            String(values[columnIndices.folder]).toLowerCase().replace(/^\s+|\s+$/g, '') : 
            'default';

        // Validate dimensions
        if (width <= 0 || height <= 0) {
            alert("Invalid dimensions for layer: " + layerName);
            continue;
        }

        try {
            if (scale2x) {
                // Create 2x version directly in temp document
                var mainDoc = app.activeDocument;
                var tempDoc = app.documents.add(width * 2, height * 2, 72, layerName + "_temp", NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
                
                // Create shape and text in temp doc at 2x size
                var tempShape = tempDoc.artLayers.add();
                tempShape.name = layerName + "_shape";
                
                // Create and fill shape at 2x size
                var bounds2x = [
                    [0, 0],
                    [width * 2, 0],
                    [width * 2, height * 2],
                    [0, height * 2]
                ];
                
                tempDoc.selection.select(bounds2x);
                var fillColor = new SolidColor();
                fillColor.rgb.red = 200;
                fillColor.rgb.green = 200;
                fillColor.rgb.blue = 200;
                tempShape.opacity = 75;
                tempDoc.selection.fill(fillColor);
                tempDoc.selection.deselect();

                // Create text layer at 2x size
                var tempText = tempDoc.artLayers.add();
                tempText.kind = LayerKind.TEXT;
                tempText.name = layerName + "_label";
                
                var tempTextItem = tempText.textItem;
                tempTextItem.kind = TextType.PARAGRAPHTEXT;
                tempTextItem.font = "ArialMT";
                tempTextItem.contents = layerName;
                tempTextItem.size = Math.min(width, height) * 0.3;
                tempTextItem.justification = Justification.CENTER;
                tempTextItem.color.rgb.red = 50;
                tempTextItem.color.rgb.green = 50;
                tempTextItem.color.rgb.blue = 50;
                tempTextItem.width = width * 2;
                tempTextItem.height = height * 2;
                tempTextItem.position = [0, 0];
                
                // Auto-size text if it's too big
                while (tempTextItem.height > height * 2 && tempTextItem.size > 12) {
                    tempTextItem.size = tempTextItem.size * 0.9;
                }
                
                // Center text vertically after sizing
                var textBounds = tempText.bounds;
                var textHeight = textBounds[3].value - textBounds[1].value;
                var verticalOffset = (height * 2 - textHeight) / 2;
                tempTextItem.position = [0, verticalOffset];

                // Convert to smart object
                tempDoc.activeLayer = tempText;
                tempShape.selected = true;
                tempText.selected = true;
                executeAction(stringIDToTypeID("newPlacedLayer"), undefined, DialogModes.NO);
                
                // Save and close temp doc
                var tempFile = new File(Folder.temp + "/" + layerName + "_temp.psd");
                tempDoc.saveAs(tempFile);
                tempDoc.close(SaveOptions.DONOTSAVECHANGES);

                // Switch back to main document and place the temp file
                app.activeDocument = mainDoc;
                var idPlc = charIDToTypeID("Plc ");
                var desc = new ActionDescriptor();
                desc.putPath(charIDToTypeID("null"), tempFile);
                // Force exact dimensions
                desc.putUnitDouble(charIDToTypeID("Wdth"), charIDToTypeID("#Pxl"), width);
                desc.putUnitDouble(charIDToTypeID("Hght"), charIDToTypeID("#Pxl"), height);
                desc.putBoolean(stringIDToTypeID("proportional"), true);  // Keep proportions
                desc.putEnumerated(charIDToTypeID("Fit "), charIDToTypeID("Fit "), charIDToTypeID("Wdth")); // Fit to width
                executeAction(idPlc, desc, DialogModes.NO);

                // Verify and force correct size if needed
                var layer = doc.activeLayer;
                var bounds = layer.bounds;
                var actualWidth = bounds[2].value - bounds[0].value;
                var actualHeight = bounds[3].value - bounds[1].value;
                
                if (Math.abs(actualWidth - width) > 1 || Math.abs(actualHeight - height) > 1) {
                    // Force resize to exact dimensions
                    layer.resize(
                        (width / actualWidth) * 100,
                        (height / actualHeight) * 100,
                        AnchorPosition.MIDDLECENTER
                    );
                }

                // Position at exact coordinates
                bounds = layer.bounds;
                doc.activeLayer.translate(
                    xPosition - bounds[0].value,
                    yPosition - bounds[1].value
                );
                doc.activeLayer.name = layerName;

                // Clean up temp file
                tempFile.remove();
            } else {
                // Create 1x version directly in main document
                var shapeLayer = doc.artLayers.add();
                shapeLayer.name = layerName + "_shape";

                // Set the layer bounds
                var bounds = [
                    [xPosition, yPosition],
                    [xPosition + width, yPosition],
                    [xPosition + width, yPosition + height],
                    [xPosition, yPosition + height]
                ];
                
                doc.selection.select(bounds);
                var fillColor = new SolidColor();
                fillColor.rgb.red = 200;
                fillColor.rgb.green = 200;
                fillColor.rgb.blue = 200;
                shapeLayer.opacity = 75;
                doc.selection.fill(fillColor);
                doc.selection.deselect();

                // Add text layer
                var textLayer = doc.artLayers.add();
                textLayer.kind = LayerKind.TEXT;
                textLayer.name = layerName + "_label";
                
                // Calculate center points for text
                var centerX = xPosition + (width / 2);
                var centerY = yPosition + (height / 2);
                
                var textItem = textLayer.textItem;
                textItem.kind = TextType.PARAGRAPHTEXT;
                textItem.font = "ArialMT";
                textItem.contents = layerName;
                textItem.size = Math.min(width, height) * 0.15;
                textItem.justification = Justification.CENTER;
                textItem.color.rgb.red = 50;
                textItem.color.rgb.green = 50;
                textItem.color.rgb.blue = 50;
                
                // Create text box the same size as the shape
                textItem.width = width;
                textItem.height = height;
                // Position text box and center vertically
                textItem.position = [xPosition, yPosition];
                
                // Auto-size text if it's too big
                while (textItem.height > height && textItem.size > 6) {
                    textItem.size = textItem.size * 0.9;
                }
                
                // Center text vertically after sizing
                var textBounds = textLayer.bounds;
                var textHeight = textBounds[3].value - textBounds[1].value;
                var verticalOffset = (height - textHeight) / 2;
                textItem.position = [xPosition, yPosition + verticalOffset];

                // Create a temporary layer group
                var tempGroup = doc.layerSets.add();
                
                // Move shape layer first, then text layer so text stays on top
                shapeLayer.move(tempGroup, ElementPlacement.INSIDE);
                textLayer.move(tempGroup, ElementPlacement.INSIDE);
                
                // Select the group
                tempGroup.selected = true;

                // Convert group to smart object
                executeAction(stringIDToTypeID("newPlacedLayer"), undefined, DialogModes.NO);
                doc.activeLayer.name = layerName;
            }

            // Move the smart object to appropriate folder if one is specified
            if (folderName && folders[folderName]) {
                doc.activeLayer.move(folders[folderName], ElementPlacement.INSIDE);
            }
            
            // Store the smart object layer
            smartObjects.push(doc.activeLayer);
        } catch(e) {
            alert("Error processing layer '" + layerName + "': " + e);
        }
    }

    // Save the document
    var saveFile = File.saveDialog("Save the Photoshop document", "*.psd");
    if (saveFile !== null) {
        try {
            doc.saveAs(saveFile);
            
            // Create "Links" folder
            var linksFolder = new Folder(saveFile.path + "/Links");
            if (!linksFolder.exists) {
                if (!linksFolder.create()) {
                    throw new Error("Failed to create Links folder");
                }
            }
            
            // Save each smart object as a separate file
            for (var i = 0; i < smartObjects.length; i++) {
                try {
                    var smartObject = smartObjects[i];
                    var smartObjectFile = new File(linksFolder + "/" + smartObject.name + ".psd");
                    
                    // Set layer visibility
                    for (var j = 0; j < doc.artLayers.length; j++) {
                        doc.artLayers[j].visible = (doc.artLayers[j] === smartObject);
                    }
                    for (var folder in folders) {
                        folders[folder].visible = true;
                    }
                    
                    // Save the smart object
                    var saveOptions = new PhotoshopSaveOptions();
                    saveOptions.embedColorProfile = true;
                    saveOptions.alphaChannels = true;
                    saveOptions.layers = true;
                    doc.saveAs(smartObjectFile, saveOptions, true, Extension.LOWERCASE);
                } catch(e) {
                    alert("Error saving smart object '" + smartObject.name + "': " + e);
                }
            }
            
            // Restore visibility
            for (var k = 0; k < doc.artLayers.length; k++) {
                doc.artLayers[k].visible = true;
            }
            
            // Final save
            doc.save();
            
            alert("Photoshop document created successfully with " + (parsedRows.length - 1) + " layers.\nSmart objects saved in the 'Links' folder.");
        } catch(e) {
            alert("Error saving document: " + e);
        }
    } else {
        alert("Document not saved. You can save it manually.");
    }
}

// Replace the direct function call with a prompt
var dimensions = promptForDocumentSize();
if (dimensions) {
    createPhotoshopDocument(dimensions.width, dimensions.height, dimensions.scale2x);
} else {
    alert("Operation cancelled by user.");
}