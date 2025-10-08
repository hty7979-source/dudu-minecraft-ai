# Contributing to Dudu - AI Gaming Companion

Thanks for your interest in contributing to Dudu! 🎮🤖

## 🌟 About Dudu

Dudu is a hobby project exploring **AI in Gaming** - specifically how intelligent automation can create engaging Minecraft experiences while being:
- 🏠 **100% Free** (using local Ollama AI)
- 🔒 **Privacy-First** (local processing)
- 🎯 **Gaming-Optimized** (smart automation reduces AI overhead)

## 🤝 How to Contribute

### 🐛 Bug Reports
- Use GitHub Issues with the "bug" label
- Include your OS, Node.js version, and AI model
- Describe steps to reproduce
- Remember: This is early development - bugs are expected! 🚧

### 💡 Feature Ideas  
- Use GitHub Issues with the "enhancement" label
- Focus on AI gaming innovations
- Consider how features can use smart automation
- Think about hobby user experience

### 🔧 Code Contributions
1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-ai-feature`
3. **Test your changes** with `npm test`
4. **Follow our coding style** (ESLint config included)
5. **Submit Pull Request**

## 🎮 Development Guidelines

### **AI Gaming Focus**
- Features should enhance AI-human gaming collaboration
- Prefer smart automation over complex AI processing
- Consider token efficiency and local AI capabilities
- Test with Ollama/Gemma2 as primary target

### **Hobby-Friendly Design**  
- Keep setup simple (5-minute install goal)
- Document clearly for non-technical users
- Prefer local solutions over cloud dependencies
- Consider resource usage on modest hardware

### **Code Quality**
```bash
# Run tests before submitting
npm test
npm run test-building
npm run test-collection

# Check code style  
npm run lint
```

## 🧠 Technical Architecture

### **Core Systems**
- `src/agent/library/smart_collect_enhanced.js` - Multi-source collection
- `src/agent/building_manager.js` - Schematic building system  
- `src/agent/library/smart_crafting.js` - Intelligent crafting
- `src/agent/commands/actions.js` - Command definitions

### **AI Integration**
- `src/models/ollama.js` - Local AI integration
- `profiles/dudu.json` - Default AI personality
- Focus on LLM-friendly tool design

## 🎯 Contribution Ideas

### 🎮 **Gaming Features**
- New building templates or schematics
- Enhanced natural language processing
- Multiplayer AI coordination
- Creative mode optimizations

### 🧠 **AI Improvements** 
- Better context awareness
- Improved memory systems  
- More efficient automation
- Local AI model optimizations

### 📚 **Documentation**
- Tutorial videos or guides
- AI model comparison guides
- Gaming showcase examples
- Troubleshooting help

### 🌍 **Community**
- Translation support
- Discord/community management
- Social media content
- User experience feedback

## 📋 Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/dudu-minecraft-ai.git
cd dudu-minecraft-ai

# Install dependencies
npm install

# Install Ollama and models
ollama pull gemma2:9b

# Configure for development
cp keys.example.json keys.json
# Edit dudu.json for your setup

# Test your setup
npm test
npm start
```

## 🎭 Coding Style

### **JavaScript/Node.js**
- Use ES6+ modules (`import/export`)
- Async/await over Promises when possible
- Clear variable names (prefer `enhancedCollect` over `eC`)
- Comment complex AI logic

### **AI Integration**
- Design commands for LLM efficiency
- Include helpful error messages
- Consider token usage in design
- Test with local models primarily

### **Documentation**
- Use emojis consistently 🎮🤖🧠
- Include examples for complex features
- Write for hobby users (avoid jargon)
- Keep README sections focused

## 🚀 Release Process

### **Version Management**
- Follow semantic versioning (1.0.0-beta)
- Tag releases for major features
- Update changelog for user-facing changes

### **Testing Requirements**
- All AI commands must work with Ollama/Gemma2
- Building system tests must pass
- Collection system tests must pass
- No breaking changes without major version bump

## 🌟 Recognition

### **Contributors**
All contributors are recognized in:
- GitHub contributors page
- Repository README acknowledgments  
- Release notes for significant contributions

### **Showcase**
Exceptional contributions may be featured in:
- Community showcases
- Documentation examples
- Social media highlights

## 📬 Community

### **Communication Channels**
- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General AI gaming conversations
- **Pull Request Reviews** - Code collaboration

### **Community Guidelines**
- Be respectful and inclusive 🤝
- Focus on constructive feedback
- Share your AI gaming experiences
- Help newcomers get started
- Remember: We're all learning about AI in gaming!

## 🎯 Project Vision

Dudu represents the future of **AI gaming companions**:
- Not replacing human creativity, but enhancing it
- Making AI accessible to hobby gamers  
- Exploring intelligent automation in games
- Building community around AI gaming innovation

**Every contribution helps advance AI in gaming! Thank you! 🚀🎮🤖**

---

*Questions? Open an issue or start a discussion. We're excited to see what you'll build with AI gaming!*