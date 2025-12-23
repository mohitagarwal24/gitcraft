# Contributing to GitCraft

Thank you for your interest in contributing to GitCraft! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in Issues
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Screenshots if applicable

### Suggesting Features

1. Check if the feature has been suggested
2. Create a new issue with:
   - Clear use case
   - Expected behavior
   - Why it would be valuable
   - Potential implementation approach

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

4. **Test your changes**
   - Test locally
   - Ensure no breaking changes
   - Add tests if applicable

5. **Commit with clear messages**
   ```bash
   git commit -m "feat: add feature description"
   ```
   
   Use conventional commits:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   
   Then create a Pull Request with:
   - Clear title and description
   - Link to related issues
   - Screenshots/videos if UI changes

## Development Setup

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup instructions.

## Code Style

- **JavaScript/TypeScript**: Follow existing patterns
- **React**: Use functional components and hooks
- **Comments**: Explain why, not what
- **Naming**: Clear, descriptive names

## Project Structure

```
gitcraft/
├── backend/          # Node.js backend
│   ├── src/
│   │   ├── agents/   # Analysis and update agents
│   │   ├── integrations/  # GitHub, Craft, LLM
│   │   └── routes/   # API routes
├── frontend/         # Next.js frontend
│   └── app/          # App router pages
└── docs/             # Documentation
```

## Areas for Contribution

### High Priority
- [ ] Multi-repository support
- [ ] Custom documentation templates
- [ ] Enhanced confidence scoring
- [ ] Better error handling
- [ ] Unit tests

### Medium Priority
- [ ] GitLab integration
- [ ] Bitbucket integration
- [ ] Custom LLM providers
- [ ] Documentation diff visualization
- [ ] Slack/Discord notifications

### Nice to Have
- [ ] AI chat interface
- [ ] Analytics dashboard
- [ ] Team collaboration features
- [ ] Mobile app
- [ ] Browser extension

## Testing

Currently, testing is manual. We welcome contributions to add:
- Unit tests (Jest)
- Integration tests
- E2E tests (Playwright)

## Documentation

When adding features:
- Update README.md if needed
- Update IMPLEMENTATION.md for technical details
- Add inline code comments
- Update SETUP_GUIDE.md if setup changes

## Questions?

- Open a Discussion on GitHub
- Join the Craft Community Slack
- Tag maintainers in issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make GitCraft better! 🎉

