#target photoshop

function createPhotoshopDocument(docWidth, docHeight) {
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

    var lines = csvContent.split('\n');
    var headers = lines[0].split(',');

    var smartObjects = []; // Array to store smart object layers

    for (var i = 1; i < lines.length; i++) {
        var values = lines[i].split(',');
        if (values.length !== headers.length) continue;

        var layerName = values[0];
        var width = parseInt(values[1]);
        var height = parseInt(values[2]);
        var xPosition = parseInt(values[3]);
        var yPosition = parseInt(values[4]);

        // Create a new layer in the main document
        var newLayer = doc.artLayers.add();
        newLayer.name = layerName;

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

        // Convert the layer to a smart object
        executeAction(stringIDToTypeID("newPlacedLayer"), undefined, DialogModes.NO);
        
        // Store the smart object layer
        smartObjects.push(doc.activeLayer);
    }

    // Save the document
    var saveFile = File.saveDialog("Save the Photoshop document", "*.psd");
    if (saveFile !== null) {
        doc.saveAs(saveFile);
        
        // Create "Links" folder
        var linksFolder = new Folder(saveFile.path + "/Links");
        if (!linksFolder.exists) {
            linksFolder.create();
        }
        
        // Save each smart object as a separate file
        for (var i = 0; i < smartObjects.length; i++) {
            var smartObject = smartObjects[i];
            var smartObjectFile = new File(linksFolder + "/" + smartObject.name + ".psd");
            
            // Temporarily make the smart object the only visible layer
            for (var j = 0; j < doc.artLayers.length; j++) {
                doc.artLayers[j].visible = (j === doc.artLayers.length - 1 - i);
            }
            
            // Save the smart object
            var saveOptions = new PhotoshopSaveOptions();
            saveOptions.embedColorProfile = true;
            saveOptions.alphaChannels = true;
            saveOptions.layers = true;
            doc.saveAs(smartObjectFile, saveOptions, true, Extension.LOWERCASE);
        }
        
        // Make all layers visible again
        for (var k = 0; k < doc.artLayers.length; k++) {
            doc.artLayers[k].visible = true;
        }
        
        // Save the main document again
        doc.save();
        
        alert("Photoshop document created successfully with " + (lines.length - 1) + " layers.\nSmart objects saved in the 'Links' folder.");
    } else {
        alert("Document not saved. You can save it manually.");
    }
}

// Call the function with desired document dimensions
createPhotoshopDocument(1920, 1080);