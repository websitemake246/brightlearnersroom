class KhalidBot {
  constructor(io) {
    this.io = io;
    this.name = '🤖 Khalid Bot';
    this.commands = {
      '.ping': this.ping,
      '.help': this.help,
      '.time': this.time,
      '.date': this.date,
      '.weather': this.weather,
      '.joke': this.joke,
      '.math': this.math,
      '.quote': this.quote,
      '.fact': this.fact,
      '.motivate': this.motivate,
      '.calculate': this.calculate
    };
    
    this.context = {};
    this.aiResponses = [
      "That's interesting! Tell me more about that.",
      "I understand. How can I help you with that?",
      "Great point! Have you considered other perspectives?",
      "I'm here to help! What else would you like to know?",
      "That's a fascinating topic for our Bright Learners!",
      "Learning is a journey. Keep asking questions!",
      "Excellent question! Let me think about that...",
      "I appreciate your curiosity. Here's what I think..."
    ];
  }

  handleMessage(roomId, sender, message) {
    const command = message.split(' ')[0].toLowerCase();
    const args = message.slice(command.length).trim();

    if (this.commands[command]) {
      const response = this.commands[command](args, sender);
      this.sendMessage(roomId, response);
    } else if (message.startsWith('.')) {
      this.sendMessage(roomId, `❌ Unknown command: ${command}. Try .help for available commands.`);
    } else {
      // AI-like response for general chat
      this.handleGeneralChat(roomId, sender, message);
    }
  }

  handleGeneralChat(roomId, sender, message) {
    // Store context
    if (!this.context[sender]) {
      this.context[sender] = [];
    }
    this.context[sender].push(message);

    // Generate response based on message content
    let response = this.generateAIResponse(message, sender);
    
    // Add a slight delay to make it feel more natural
    setTimeout(() => {
      this.sendMessage(roomId, response);
    }, 1000);
  }

  generateAIResponse(message, sender) {
    const lowerMessage = message.toLowerCase();
    
    // Check for specific keywords
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return `Hello ${sender}! 👋 How can I assist you with your learning today?`;
    }
    
    if (lowerMessage.includes('how are you')) {
      return `I'm doing great, ${sender}! Ready to help our Bright Learners! 🌟`;
    }
    
    if (lowerMessage.includes('thank')) {
      return `You're welcome, ${sender}! 😊 Always happy to help!`;
    }
    
    if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
      return `Goodbye, ${sender}! Keep learning and growing! 📚`;
    }
    
    if (lowerMessage.includes('what is') || lowerMessage.includes('what are')) {
      return `That's a great question, ${sender}! Let me help you understand that better. What specific aspect would you like to know?`;
    }
    
    if (lowerMessage.includes('how to')) {
      return `Learning how to do new things is exciting! I'd be happy to guide you through that process, ${sender}.`;
    }
    
    // Check context for previous messages
    if (this.context[sender] && this.context[sender].length > 1) {
      const lastMessage = this.context[sender][this.context[sender].length - 2];
      if (lastMessage) {
        return `Following up on our previous discussion about "${lastMessage.substring(0, 30)}...", I think we're making good progress! 📈`;
      }
    }
    
    // Random AI-like response
    return this.aiResponses[Math.floor(Math.random() * this.aiResponses.length)];
  }

  sendMessage(roomId, text) {
    this.io.to(roomId).emit('chat-message', {
      username: this.name,
      text: text,
      timestamp: new Date(),
      isBot: true
    });
  }

  // Command implementations
  ping(args, sender) {
    return `🏓 Pong! Response time: ${Math.floor(Math.random() * 100) + 50}ms`;
  }

  help() {
    return `📚 **Khalid Bot Commands** 📚
    
**.ping** - Check bot response time
**.time** - Get current time
**.date** - Get current date
**.weather [city]** - Get weather info (demo)
**.joke** - Tell a random joke
**.math [expression]** - Calculate math expression
**.quote** - Get an inspirational quote
**.fact** - Get a random fact
**.motivate** - Get motivational message
**.calculate [num1] [operator] [num2]** - Simple calculator

Just chat with me naturally! I respond to regular messages too! 🌟`;
  }

  time() {
    return `🕐 Current time: ${new Date().toLocaleTimeString()}`;
  }

  date() {
    return `📅 Today's date: ${new Date().toLocaleDateString()}`;
  }

  weather(city) {
    if (!city) return "Please specify a city: .weather [city name]";
    const conditions = ['Sunny', 'Cloudy', 'Rainy', 'Windy', 'Snowy'];
    const temp = Math.floor(Math.random() * 30) + 10;
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    return `🌤 Weather in ${city}: ${condition}, ${temp}°C`;
  }

  joke() {
    const jokes = [
      "Why don't scientists trust atoms? Because they make up everything! 😄",
      "What do you call a bear with no teeth? A gummy bear! 🐻",
      "Why did the math book look so sad? Because it had too many problems! 📚",
      "What do you call a fake noodle? An impasta! 🍝",
      "Why don't eggs tell jokes? They'd crack each other up! 🥚"
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  math(expression) {
    try {
      // Safe eval for basic math
      const result = Function('"use strict";return (' + expression + ')')();
      return `🧮 Result: ${expression} = ${result}`;
    } catch (e) {
      return "❌ Invalid math expression. Try something like: 2+2 or 5*3";
    }
  }

  quote() {
    const quotes = [
      "The expert in anything was once a beginner. - Helen Hayes",
      "Education is the most powerful weapon to change the world. - Nelson Mandela",
      "Live as if you were to die tomorrow. Learn as if you were to live forever. - Gandhi",
      "The beautiful thing about learning is that no one can take it away from you. - B.B. King",
      "Education is not preparation for life; education is life itself. - John Dewey"
    ];
    return `💭 ${quotes[Math.floor(Math.random() * quotes.length)]}`;
  }

  fact() {
    const facts = [
      "Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs!",
      "A day on Venus is longer than a year on Venus.",
      "Bananas are berries, but strawberries aren't!",
      "Octopuses have three hearts and blue blood!",
      "The Eiffel Tower can be 15 cm taller during summer due to thermal expansion."
    ];
    return `📌 Random fact: ${facts[Math.floor(Math.random() * facts.length)]}`;
  }

  motivate() {
    const messages = [
      "You're doing great! Keep pushing forward! 💪",
      "Every expert was once a beginner. Keep learning! 🌱",
      "Your potential is limitless. Believe in yourself! ✨",
      "Mistakes are proof that you're trying. Keep going! 🎯",
      "Today is a great day to learn something new! 📚"
    ];
    return `💪 ${messages[Math.floor(Math.random() * messages.length)]}`;
  }

  calculate(args) {
    const parts = args.split(' ');
    if (parts.length !== 3) {
      return "Usage: .calculate [num1] [operator] [num2] (e.g., .calculate 5 + 3)";
    }
    
    const num1 = parseFloat(parts[0]);
    const op = parts[1];
    const num2 = parseFloat(parts[2]);
    
    if (isNaN(num1) || isNaN(num2)) {
      return "Please provide valid numbers";
    }
    
    let result;
    switch(op) {
      case '+': result = num1 + num2; break;
      case '-': result = num1 - num2; break;
      case '*': result = num1 * num2; break;
      case '/': result = num2 !== 0 ? num1 / num2 : "Cannot divide by zero"; break;
      default: return "Supported operators: +, -, *, /";
    }
    
    return `🧮 ${num1} ${op} ${num2} = ${result}`;
  }
}

module.exports = KhalidBot;
