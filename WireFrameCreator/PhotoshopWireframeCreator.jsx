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
    
    // Add buttons
    var btnGroup = dlg.add("group");
    btnGroup.add("button", undefined, "OK");
    btnGroup.add("button", undefined, "Cancel");
    
    // Show dialog and return results
    if (dlg.show() == 1) {
        return {
            width: parseInt(widthInput.text),
            height: parseInt(heightInput.text)
        };
    }
    return null;
}

function createPhotoshopDocument(docWidth, docHeight) {
    // Open file dialog to choose CSV
    var csvFile = File.openDialog("Select a CSV file", "*.csv");
    if (csvFile === null) {
        alert("No file selected. Script terminated.");
        return;
    }

    // Create the main document
    var doc = app.documents.add(docWidth, docHeight);

    // Create folder structure
    var folders = {
        foreground: doc.layerSets.add(),
        background: doc.layerSets.add(),
        UI: doc.layerSets.add()
    };
    
    folders.foreground.name = "foreground";
    folders.background.name = "background";
    folders.UI.name = "UI";

    // Read and parse the CSV file
    csvFile.open('r');
    var csvContent = csvFile.read();
    csvFile.close();

    var lines = csvContent.split('\n');
    
    // Clean headers - using String() for conversion and replacing trim() with regex
    var headers = lines[0].split(',');
    for (var h = 0; h < headers.length; h++) {
        headers[h] = String(headers[h]).replace(/^\s+|\s+$/g, '');
    }

    var smartObjects = []; // Array to store smart object layers

    for (var i = 1; i < lines.length; i++) {
        // Skip empty lines
        if (!String(lines[i]).replace(/^\s+|\s+$/g, '')) continue;
        
        // Split and trim each value
        var values = lines[i].split(',');
        for (var v = 0; v < values.length; v++) {
            values[v] = String(values[v]).replace(/^\s+|\s+$/g, '');
        }
        
        if (values.length !== headers.length) continue;

        var layerName = values[0];
        var width = parseInt(values[1], 10) || 0;  // Added fallback to 0
        var height = parseInt(values[2], 10) || 0;
        var xPosition = parseInt(values[3], 10) || 0;
        var yPosition = parseInt(values[4], 10) || 0;
        var folderName = String(values[5]).toLowerCase().replace(/^\s+|\s+$/g, '');

        // Validate dimensions
        if (width <= 0 || height <= 0) {
            alert("Invalid dimensions for layer: " + layerName);
            continue;
        }

        try {
            // Create a new layer in the main document
            var shapeLayer = doc.artLayers.add();
            shapeLayer.name = layerName + "_shape";

            // Set the layer bounds
            var bounds = [
                [xPosition, yPosition],
                [xPosition + width, yPosition],
                [xPosition + width, yPosition + height],
                [xPosition, yPosition + height]
            ];
            
            // Create a selection and fill it with light gray
            doc.selection.select(bounds);
            var fillColor = new SolidColor();
            fillColor.rgb.red = 200;
            fillColor.rgb.green = 200;
            fillColor.rgb.blue = 200;
            doc.selection.fill(fillColor);
            doc.selection.deselect();

            // Add text layer
            var textLayer = doc.artLayers.add();
            textLayer.kind = LayerKind.TEXT;
            textLayer.name = layerName + "_label";
            
            // Set text properties
            var textItem = textLayer.textItem;
            textItem.kind = TextType.POINTTEXT;
            textItem.font = "ArialMT";
            textItem.contents = layerName;
            textItem.size = Math.min(width, height) * 0.15;
            textItem.justification = Justification.CENTER;
            textItem.color.rgb.red = 50;
            textItem.color.rgb.green = 50;
            textItem.color.rgb.blue = 50;
            
            // Center the text in the object
            var centerX = xPosition + (width / 2);
            var centerY = yPosition + (height / 2);
            textItem.position = [centerX, centerY];

            // Create a temporary layer group
            var tempGroup = doc.layerSets.add();
            
            // Move shape layer first, then text layer so text stays on top
            shapeLayer.move(tempGroup, ElementPlacement.INSIDE);
            textLayer.move(tempGroup, ElementPlacement.INSIDE);
            
            // Select the group
            tempGroup.selected = true;

            // Convert group to smart object
            executeAction(stringIDToTypeID("newPlacedLayer"), undefined, DialogModes.NO);
            doc.activeLayer.name = layerName;  // Rename the smart object
            
            // Move the smart object to appropriate folder
            if (folders[folderName]) {
                doc.activeLayer.move(folders[folderName], ElementPlacement.INSIDE);
            } else {
                alert("Warning: Invalid folder name '" + folderName + "' for layer '" + layerName + "'");
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
            
            // Create "Links" folder with subfolders
            var linksFolder = new Folder(saveFile.path + "/Links");
            if (!linksFolder.exists) {
                if (!linksFolder.create()) {
                    throw new Error("Failed to create Links folder");
                }
            }
            
            // Create subfolders in Links
            var linksFolders = {
                foreground: new Folder(linksFolder + "/foreground"),
                background: new Folder(linksFolder + "/background"),
                UI: new Folder(linksFolder + "/UI")
            };
            
            for (var folder in linksFolders) {
                if (!linksFolders[folder].exists) {
                    if (!linksFolders[folder].create()) {
                        alert("Warning: Failed to create folder: " + folder);
                    }
                }
            }
            
            // Save each smart object as a separate file
            for (var i = 0; i < smartObjects.length; i++) {
                try {
                    var smartObject = smartObjects[i];
                    var folderName = smartObject.parent.name.toLowerCase();
                    var smartObjectFile = new File(linksFolders[folderName] + "/" + smartObject.name + ".psd");
                    
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
            
            alert("Photoshop document created successfully with " + (lines.length - 1) + " layers.\nSmart objects saved in the 'Links' folder.");
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
    createPhotoshopDocument(dimensions.width, dimensions.height);
} else {
    alert("Operation cancelled by user.");
}