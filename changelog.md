**v0.5.0**
* Rebuilds event system.
* All the path until the change is rebuilt now.
* State changes happen faster, on tick or on message.

**v0.4.0**
* Event listeners are conserved on state changes
* Changes in detached nodes are not emiting events anymore, a warning is shown in this case.
* Emit now returns the last non-undefined return value from the callbacks.

**v0.3.0**
* Custom events handled ok
* Adds off method
* Adds warnings for adding wrong listeners to the nodes
* Fixes array splice throwing an error
* 100% testing coverage

**v0.2.0**
* Moves UMD adapter out of the source code
* Creates build system
* Adds travis CI
* Adds coveralls
* Third strategy
* Forbid adding previous nodes

**v0.1.0**
* Memory leaks handled
* Two strategies
* Added tests
* We have a change log
* Add unchanged node preservation

**v0.0.1**
Initial version, proof of concept