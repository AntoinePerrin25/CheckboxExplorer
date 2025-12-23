# Checkbox Display

Une extension VS Code qui détecte et affiche des checkboxes interactives dans l'éditeur de texte.

## Fonctionnalités

Cette extension détecte automatiquement les patterns de checkbox dans vos fichiers et les affiche sous forme de symboles visuels :
- `# [CB]:0|1` devient ☐ (non coché) ou ☑ (coché)
- Détection et rendu automatique dans tous les fichiers
- Affichage visuel en temps réel

## Utilisation

### Format de checkbox

Utilisez le format suivant dans vos fichiers :
```
# [CB]:0|1
```
- Le premier chiffre (0 ou 1) indique l'état actuel de la checkbox
- Le second chiffre est utilisé pour l'état alternatif

### Exemple

```python
checkboxFile = 1 # [CB]:0|1
if checkboxFile :
    file = "example.txt"
else :
    file = "exam.txt"
```

### Toggle checkbox

- Placez votre curseur sur une ligne contenant une checkbox
- Utilisez le raccourci clavier :
  - **macOS**: `Cmd+Shift+C`
  - **Windows/Linux**: `Ctrl+Shift+C`
- Ou utilisez la palette de commandes : `Toggle Checkbox`

## Installation pour développement

1. Clonez ce repository
2. Ouvrez le dossier dans VS Code
3. Exécutez `npm install`
4. Appuyez sur `F5` pour lancer l'extension en mode debug
5. Une nouvelle fenêtre VS Code s'ouvrira avec l'extension activée

## Release Notes

### 0.0.1

Version initiale :
- Détection automatique des patterns `# [CB]:0|1`
- Affichage visuel des checkboxes
- Commande pour toggle l'état des checkboxes