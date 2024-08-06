package org.worldcubeassociation.tnoodle;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.io.FileWriter;
import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.worldcubeassociation.tnoodle.puzzle.ThreeByThreeCubePuzzle;
import org.worldcubeassociation.tnoodle.scrambles.InvalidScrambleException;
import org.worldcubeassociation.tnoodle.scrambles.PuzzleStateAndGenerator;
import org.worldcubeassociation.tnoodle.svglite.Svg;

public class ScrambleDatasetGenerator {

    public static void main(String[] args) {
        // Initialize the puzzle for generating 3x3 cube scrambles
        ThreeByThreeCubePuzzle puzzle = new ThreeByThreeCubePuzzle();
        Random random = new Random();  // Random generator for creating scrambles

        // Define the number of scrambles you want to generate
        int numScrambles = 20000; // You can adjust this number based on your needs

        // File to save the dataset in CSV format
        try (FileWriter csvWriter = new FileWriter("scramble_dataset.csv")) {

            // Write the CSV header with scramble sequence and sticker positions
            csvWriter.append("Scramble Sequence");

            // Define the cube faces
            char[] faces = {'L', 'D', 'B', 'R', 'U', 'F'};
            // Write the headers for each face's stickers (9 per face)
            for(int i = 0; i < 6; i++){
                for(int j = 0; j < 9; j++){
                    csvWriter.append(","+faces[i]+(j+1));
                }
            }
            csvWriter.append("\n");

            // Loop to generate the specified number of scrambles
            for (int i = 0; i < numScrambles; i++) {
                // Generate a random scramble
                PuzzleStateAndGenerator scramble = puzzle.generateRandomMoves(random);
                String scrambleSequence = scramble.generator; // Get the scramble sequence as a string

                // Generate the SVG (Scalable Vector Graphics) representation of the scramble
                Svg svg = puzzle.drawScramble(scrambleSequence, puzzle.getDefaultColorScheme());
                String svgString = svg.toString(); // Convert the SVG to a string

                // Regular expression pattern to match color fills in the SVG
                Pattern pattern = Pattern.compile("fill=\"(.*?)\"");

                // Matcher to find all fill values (colors) in the SVG
                Matcher matcher = pattern.matcher(svgString);

                // List to store the extracted colors
                List<String> fillValues = new ArrayList<>();

                // Find and add each color value to the list
                while (matcher.find()) {
                    fillValues.add(matcher.group(1)); // Extract the color value inside the fill attribute
                }

                // Convert the list of colors to an array (not necessary but kept for further processing)
                String[] fillValuesArray = fillValues.toArray(new String[0]);

                // Write the scramble sequence to the CSV
                csvWriter.append(scrambleSequence);

                // Write each sticker color to the CSV
                for(int k = 0; k < fillValuesArray.length; k++){
                    String stickerColor = fillValuesArray[k]; // Get the color value

                    // Translate hex color codes to color names
                    switch (stickerColor){
                        case "#ff8000":
                            stickerColor = "orange";
                            break;
                        case "#ff0000":
                            stickerColor = "red";
                            break;
                        case "#0000ff":
                            stickerColor = "blue";
                            break;
                        case "#00ff00":
                            stickerColor = "green";
                            break;
                        case "#ffff00":
                            stickerColor = "yellow";
                            break;
                        case "#ffffff":
                            stickerColor = "white";
                            break;
                    }

                    // Append the color name to the CSV
                    csvWriter.append(",").append(stickerColor);
                }
                // End of the current line in the CSV
                csvWriter.append("\n");
            }

            // Print a message indicating that the dataset generation is complete
            System.out.println("Dataset generation complete.");
        } catch (IOException e) {
            // Handle any IO exceptions that occur during file writing
            e.printStackTrace();
        } catch (InvalidScrambleException e) {
            // Handle any exceptions related to invalid scrambles
            throw new RuntimeException(e);
        }
    }
}
