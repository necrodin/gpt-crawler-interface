// DOM Elements
let startBtn, statusLog, loader, statusBadge, results, outputPathText, downloadJsonBtn, downloadMdBtn;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    startBtn = document.getElementById('startBtn');
    statusLog = document.getElementById('status-log');
    loader = document.getElementById('loader');
    statusBadge = document.getElementById('statusBadge');
    results = document.getElementById('results');
    outputPathText = document.getElementById('outputPathText');
    downloadJsonBtn = document.getElementById('downloadJsonBtn');
    downloadMdBtn = document.getElementById('downloadMdBtn');

    // Validate elements exist
    if (!startBtn) {
        console.error('startBtn not found');
        return;
    }

    // Attach event listener
    startBtn.addEventListener('click', startCrawl);
    
    // Attach download button event listeners
    if (downloadJsonBtn) {
        downloadJsonBtn.addEventListener('click', downloadJson);
    }
    if (downloadMdBtn) {
        downloadMdBtn.addEventListener('click', downloadMarkdown);
    }

    // Add default log messages
    addLog('GPT Crawler interface loaded', 'info');
    addLog('Configure settings and click "Start Crawl" button', 'info');
});

// Download JSON function
function downloadJson() {
    if (window.currentOutputPath) {
        // Download URL is already like "output/filename.json" or just "filename.json"
        // server returns relative path, we prepend '/output/'
        window.location.href = '/output/' + window.currentOutputPath;
        addLog('Downloading JSON file...', 'success');
    }
}

// Download Markdown function
function downloadMarkdown() {
    if (window.currentOutputPath) {
        addLog('Converting to Markdown format...', 'info');
        
        fetch('/api/convert-to-md', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ outputPath: window.currentOutputPath })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                // downloadUrl is already the filename (e.g., "kvkk.md")
                // server returns just the filename, we prepend '/output/'
                window.location.href = '/output/' + result.downloadUrl;
                addLog('Downloading Markdown file...', 'success');
            } else {
                addLog('Markdown conversion failed: ' + result.error, 'error');
            }
        })
        .catch(error => {
            addLog('Error: ' + error.message, 'error');
        });
    }
}

// Add log function
function addLog(message, type = 'info') {
    const div = document.createElement('div');
    div.className = type === 'error' ? 'text-red-400' : type === 'success' ? 'text-green-400' : 'text-gray-400';
    const timestamp = new Date().toLocaleTimeString();
    div.innerHTML = `<span class="text-gray-600">[${timestamp}]</span> ${message}`;
    statusLog.appendChild(div);
    statusLog.scrollTop = statusLog.scrollHeight;
}

// Format resource exclusions
function getResourceExclusions() {
    // For now, use default exclusions
    return ['png','jpg','jpeg','gif','svg','css','js','ico','woff','woff2','ttf','eot'];
}

// Crawler Configuration
function getConfig() {
    return {
        url: document.getElementById('url').value.trim(),
        match: document.getElementById('match').value.trim(),
        exclude: undefined,
        selector: document.getElementById('selector').value.trim() || undefined,
        maxPagesToCrawl: parseInt(document.getElementById('maxPages').value) || 50,
        outputFileName: document.getElementById('outputFileName').value.trim() || 'output.json',
        waitForSelectorTimeout: parseInt(document.getElementById('timeout').value) || 20000,
        maxTokens: 0,
        maxFileSize: 0,
        resourceExclusions: getResourceExclusions()
    };
}

// Start Crawl
async function startCrawl() {
    const config = getConfig();

    // Validate
    if (!config.url) {
        addLog('Please enter a URL', 'error');
        return;
    }
    if (!config.match) {
        addLog('Please enter a match pattern', 'error');
        return;
    }

    // UI updates
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Crawling...';
    loader.style.display = 'block';
    statusBadge.className = 'badge bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm';
    statusBadge.innerHTML = '<i class="fas fa-search mr-2"></i>Crawling in progress';
    results.classList.add('hidden');
    addLog('Starting crawling...', 'info');

    try {
        // Start crawling via API
        const response = await fetch('/api/crawl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.success) {
            addLog('Crawling completed! Output: ' + result.outputPath, 'success');
            
            statusBadge.className = 'badge bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm';
            statusBadge.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Completed';
            results.classList.remove('hidden');
            
            // Set output path
            outputPathText.textContent = 'Output: ' + result.outputPath;
            
            // Enable download
            window.currentOutputPath = result.outputPath;
        } else {
            addLog('Error: ' + result.error, 'error');
            statusBadge.className = 'badge bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm';
            statusBadge.innerHTML = '<i class="fas fa-exclamation-circle mr-2"></i>Error';
        }
    } catch (error) {
        addLog('Error: ' + error.message, 'error');
        statusBadge.className = 'badge bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm';
        statusBadge.innerHTML = '<i class="fas fa-exclamation-circle mr-2"></i>Error';
    } finally {
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fas fa-play mr-2"></i>Start Crawl';
        loader.style.display = 'none';
    }
}



// Tab switching
function switchTab(tabName) {
    // Hide all tabs
    document.getElementById('crawl-tab').classList.add('hidden');
    document.getElementById('settings-tab').classList.add('hidden');
    
    // Remove active class from all tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    
    // Set active tab
    const activeTab = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
}
