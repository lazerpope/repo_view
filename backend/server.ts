const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/data", (req, res) => {
  res.json([
          {
              type: 'folder', iabel: 'folder1', contains: [
                  {
                      type: 'folder', iabel: 'folder2', contains:
                          [{ type: 'file', iabel: 'file2', imports: ['import3', 'import2', 'file1'] }
                          ]
                  },
                  { type: 'file', iabel: 'file1', imports: ['import1', 'import2'] }
              ]
          }]);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});