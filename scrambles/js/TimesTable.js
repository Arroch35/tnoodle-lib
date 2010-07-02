//TODO - it would be nice to have this in mootools
function isOrIsChild(el, parent) {
	while(el != null) {
		if(el == parent)
			return true;
		el = el.parentNode;
	}
	return false;
}

var TimesTable = new Class({
	Extends: HtmlTable,
	ras: [ 'mean3', 'ra5', 'ra12', 'ave100' ],
	initialize: function(id, server, scrambleStuff) {
	//TODO - select multiple times for deletion
		this.server = server;
		this.configuration = server.configuration;
		this.scrambleStuff = scrambleStuff
		var table = this;
		HtmlTable.Parsers.time = {
			match: /^.*$/,
			convert: function() {
				if(isOrIsChild(this, table.sizerRow))
					return Infinity;
				return this.timeCentis;
			},
			number: true
		};
		//this parser will ignore our sizer tr
		HtmlTable.Parsers.num = {
			match: HtmlTable.Parsers.number.match,
			convert: function() {
				if(isOrIsChild(this, table.sizerRow)) {
					return Infinity;
				}
				return HtmlTable.Parsers.number.convert.call(this);
			},
			number: HtmlTable.Parsers.number.number
		};
		this.parent(id, {
			headers: [ '', 'Time', 'Mean 3', 'Ra 5', 'Ra 12', 'Ave 100', 'Session Ave' ],
			parsers: [ HtmlTable.Parsers.num, HtmlTable.Parsers.time ],
			rows: [],
			sortable: true,
			zebra: false,
		});
		this.addEvent('onSort', function(tbody, index) {
			this.configuration.set('times.sort', this.sorted);
			this.scrollToLastTime();
			if(this.sizerRow)
				this.sizerRow.inject(this.tbody);
			this.tbody.getChildren('tr').each(function(tr) {
				tr.refresh();
			});
		});
		
		this.tbody = $(this).getChildren('tbody')[0];
		
		//we create the add time row
		this.addRow = this.push([ '', '<u>A</u>dd time', '', '', '', '', '' ]).tr.dispose();
		this.addRow.addClass('addTime');
		this.addRow.addEvent('click', function(e) {
			this.rowClicked(e, this.addRow, null);
		}.bind(this));
		
		//there needs to be some dummy content in this row so it gets sized correctly
		//only vertical sizing matters though
		this.infoRow = this.set('footers', [ 'J', '', '', '', '', '', '' ]).tr;

		var format = server.formatTime;
		this.infoRow.refresh = function() {
			var cells = this.infoRow.getChildren();
			var col = -1;
			
			cells[++col].set('html', this.session.solveCount()+"/"+this.session.attemptCount());
			cells[++col].set('html', format(this.session.bestWorst().best.centis));
			cells[col].addClass('bestTime');
			
			for(var i = 0; i < this.ras.length; i++) {
				var best = this.session.bestWorst(this.ras[i]).best;
				cells[++col].set('html', format(best.centis));
				cells[col].removeClass('bestRA');
				if(best.index != null)
					cells[col].addClass('bestRA');
			}
			cells[++col].set('html', '&sigma; = ' + format(this.session.stdDev()));
		}.bind(this);
		this.addRow.inject(this.infoRow, 'before'); //place the add row in the footer
		
		//this row serves as the spine for our tbody
		this.sizerRow = new Element('tr', { 'class': 'sizerRow' });
		this.sizerRow.refresh = function() {};
		
		window.addEvent('click', this.deselectRow.bind(this));
		window.addEvent('keydown', function(e) {
			if(e.key == 'esc')
				this.deselectRow();
		}.bind(this));
	},
	freshSession: false,
	setSession: function(session) {
		this.freshSession = true;
		this.session = session;
		this.empty();
		this.session.times.each(function(time) {
			this.add(time);
		}.bind(this));

		this.resort();
		this.infoRow.refresh();
		this.resize();
	},
	reset: function() {
		this.session.reset();
		this.tbody.empty();
		this.refreshData();
	},
	addTime: function(centis) {
		var time = this.session.addTime(centis, this.scrambleStuff.getScramble());
		this.scrambleStuff.scramble();
		this.add(time);
		this.resort();
		this.infoRow.refresh();
		this.resize(true);
	},
	scrollToLastTime: function() {
		if(this.lastAddedRow)
			this.scrollToRow(this.lastAddedRow);
	},
	scrollToRow: function(tr) {
		var scrollTop = this.tbody.scrollTop;
		var scrollBottom = scrollTop + this.tbody.getSize().y;
		
		var elTop = tr.getPosition(tr.getParent()).y;
		var elBottom = tr.getSize().y + elTop;
		
		if(elTop < scrollTop) {
			//we scroll up just until the top of the row is visible
			this.tbody.scrollTo(0, elTop);
		} else if(elBottom > scrollBottom) {
			//we scroll down just until the bottom of the element is visible
			var delta = elBottom - scrollBottom;
			delta += 3; //add a couple for the border, TODO - compute border!
			this.tbody.scrollTo(0, scrollTop + delta);
		} else {
			//the element's on screen!
		}
		
	},
	promptTime: function() {
		this.rowClicked(null, this.addRow, null);
	},
	
	//private!
	resort: function(preserveScrollbar) {
		var scrollTop = this.tbody.scrollTop; //save scroll amount
		var sort = this.configuration.get('times.sort', { index: 0, reverse: false });
		this.sort(sort.index, sort.reverse);
		this.sizerRow.inject(this.tbody);
		
		if(preserveScrollbar)
			this.tbody.scrollTo(0, scrollTop); //restore scroll amount
	},
	selectedRow: null,
	editRow: null,
	rowClicked: function(e, row, time) {
		if(e) e.stop(); //don't want this to be treated as an unfocus event until we know which row was clicked
		if(row == this.selectedRow) {
			return;
		}
		if(this.selectedRow != null) {
			this.deselectRow();
		}

		this.attachSorts(false); //sorting doesn't work well with a selected row
		this.selectedRow = row;
		
		this.editRow = new Element('tr');
		this.editRow.setStyle('width', this.selectedRow.getSize().x);
		this.editRow.addClass('editRow');
		this.editRow.addEvent('click', function(e) { e.stop(); }); //we don't want this to propagate up to the current function
		
		var deleteTimeFunc = function(e) {
			this.session.disposeTime(time); //remove time
			this.deselectRow().dispose(); //deselect and remove current row
		}.bind(this)
		var deleteTime = new Element('td');
		deleteTime.inject(this.editRow);
		if(time) {
			deleteTime.set('html', 'X');
			deleteTime.addClass('deleteTime'); //TODO - pretty picture
			deleteTime.addEvent('click', deleteTimeFunc);
		}
		
		var textField = new Element('input');
		var timeChanged = function(e) {
			try {
				new this.server.Time(textField.value);
				errorField.set('html', '');
			} catch(error) {
				errorField.set('html', error);
			}
		}.bind(this);
		//TODO - how do you listen for input in mootools?
		xAddListener(textField, 'input', timeChanged, false);
		
		textField.setAttribute('type', 'text');
		textField.value = time == null ? "" : time.format();
		//TODO - do something that doesn't depend on %
		textField.setStyle('width', '90%');
		
		function onBlur(e) {
			//accept time if at all possible
			acceptTime();
		}
		var acceptTime = function() {
			//if successful, this function may cause blur, which causes double adding of timess
			textField.removeEvent('blur', onBlur);
			try {
				if(time == null) {
					this.addTime(textField.value);
				} else {
					time.parse(textField.value);
					penalties[String(time.getPenalty())].checked = true;
					this.session.reindex();
				}
				return true;
			} catch(error) {
				return false;
			} finally {
				textField.addEvent('blur', onBlur);
			}
		}.bind(this);
		textField.addEvent('keydown', function(e) {
			if(e.key == 'esc') {
				//calling deselectRow() will cause a blur, which would cause acceptance of the time
				textField.removeEvent('blur', onBlur);
				this.deselectRow();
			}
			if(e.key == 'enter')
				if(acceptTime())
					this.deselectRow();
		}.bind(this));
		textField.addEvent('blur', onBlur);
		var col2 = new Element('td').adopt(textField);
		col2.inject(this.editRow);

		var errorField = new Element('div', { 'class': 'errorField' });
		var col3 = new Element('td', { colspan: 5 }).adopt(errorField);
		col3.inject(this.editRow);

		//sizing up w/ previous row, i don't know why this doesn't just work when adding a time
		if(!time) {
			deleteTime.setStyle('width', this.selectedRow.getChildren()[0].getStyle('width'));
			col2.setStyle('width', this.selectedRow.getChildren()[1].getStyle('width'));
			var remainder = this.tbody.getSize().x - this.selectedRow.getChildren()[2].getPosition(this.tbody).x - 1; //subtract 1 for the border
			col3.setStyle('width', remainder);
		}
		
		this.editRow.replaces(this.selectedRow);
		
		if(time) {
			function makeLabel(el) {
				var label = new Element('label', {'for': el.id, html: el.value});
				el.inject(label, 'top');
				return label;
			}
			
			var fieldSet = new Element('fieldset');
			fieldSet.adopt(new Element('legend', {html: "Penalty"}));
			var noPenalty = new Element('input', { type: 'radio', name: 'penalty', value: 'No penalty', id: 'noPenalty' });
			fieldSet.adopt(makeLabel(noPenalty));
			var dnf = new Element('input', { type: 'radio', name: 'penalty', value: 'DNF', id: 'dnf' });
			fieldSet.adopt(makeLabel(dnf));
			var plusTwo = new Element('input', { type: 'radio', name: 'penalty', value: '+2', id: 'plusTwo' });
			
			//select the correct penalty
			var penalties = { "null": noPenalty, "DNF": dnf, "+2": plusTwo };
			penalties[String(time.getPenalty())].checked = true;
			
			fieldSet.adopt(makeLabel(plusTwo));
			var form = new Element('form');
			form.adopt(fieldSet);
			fieldSet.addEvent('change', function(e) {
				if(noPenalty.checked) {
					time.setPenalty(null);
				} else if(dnf.checked) {
					time.setPenalty("DNF");
				} else if(plusTwo.checked) {
					time.setPenalty("+2");
				} else {
					//this shouldn't happen
				}
				this.session.reindex();
				textField.value = time.format();
				timeChanged();
			}.bind(this));
			
			var optionsButton = new Element('div', { html: '^', 'class': 'optionsButton' });
			optionsButton.setStyle('position', 'relative'); //so hacky
			optionsButton.setStyle('left', '5px');
			optionsButton.setStyle('background-color', '#A0A0FF');
			
			var optionsDiv = new Element('div', { 'class': 'options' });
			optionsDiv.setStyle('width', '200px'); //TODO - compute width dynamically
			optionsDiv.show = function() {
				optionsDiv.setStyle('display', '');
				optionsDiv.position({relativeTo: optionsButton, position: 'topLeft', edge: 'bottomLeft'});
				optionsDiv.fade('in');
				optionsButton.morph('.optionsButtonHover');
			};
			optionsDiv.hide = function() {
				optionsDiv.fade('out');
				optionsButton.morph({ 'background-color': '#A0A0FF', color: '#000' }); //this is awful
			};
			optionsDiv.setStyle('display', 'none'); //for some reason, setting visiblity: none doesn't seem to work here
			optionsDiv.hide(); //this allows the first show() to animate
			
			optionsButton.addEvent('mouseover', optionsDiv.show);
			optionsButton.addEvent('mouseout', optionsDiv.hide);
			optionsDiv.addEvent('mouseover', optionsDiv.show);
			optionsDiv.addEvent('mouseout', optionsDiv.hide);
			
			function createTagBox(tag, checked) {
				var checkbox = new Element('input', { id: tag, type: 'checkbox' });
				checkbox.checked = checked;
				checkbox.addEvent('change', function(e) {
					if(this.checked)
						time.addTag(tag);
					else
						time.removeTag(tag);
				});
				checkbox.addEvent('focus', function(e) {
					this.blur();
				});
				return new Element('div').adopt(checkbox).adopt(new Element('label', { 'html': tag, 'for': tag }));
			}
			optionsDiv.refresh = function() {
				var tags = this.server.getTags(this.session.getPuzzle());
				for(var i = 0; i < tags.length; i++)
					optionsDiv.adopt(createTagBox(tags[i], time.hasTag(tags[i])));
				
				// all of this tagging code is some of the worst code i've written for tnt,
				// probably because it's 7:30 am, and i want to go to sleep
				// TODO - but it's important that there eventually is a better dialog for editing tags 
				// that doesn't cause the current row to lose focus
				var addTagLink = new Element('span', { 'class': 'link', html: 'Add tag' });
				addTagLink.addEvent('click', function(e) {
					var tag = prompt("Enter name of new tag (I promise this will become a not-crappy gui someday)");
					if(tag) {
						this.server.createTag(this.session.getPuzzle(), tag);
						optionsDiv.refresh();
					}
				}.bind(this));
				optionsDiv.adopt(addTagLink);
			}.bind(this);
			optionsDiv.refresh();

			this.penaltyRow = new Element('tr', {'class': 'penaltyRow' });
			var extraDelete = new Element('td', {'class': 'extendedDeleteTime'});
			extraDelete.addEvent('click', deleteTimeFunc);
			this.penaltyRow.adopt(extraDelete);
			this.penaltyRow.adopt(new Element('td', { colspan: 4}).adopt(form));
			this.penaltyRow.adopt(new Element('td', { colspan: 2}).adopt(optionsButton));
			optionsDiv.inject(this.penaltyRow);
			this.penaltyRow.inject(this.editRow, 'after');
			this.scrollToRow(this.penaltyRow);
		} else
			this.penaltyRow = null;

		timeChanged();
		textField.focus(); //this has the added benefit of making the row visible
		textField.select();
	},
	deselectRow: function(e) {
		if(e) {
			if(e.rightClick) return null; //we don't let right clicking deselect a row
			if(isOrIsChild(e.target, this.penaltyRow))
				return null;
		}
		
		var row = this.selectedRow;
		if(this.selectedRow != null) {
			this.attachSorts(true); //sorting doesn't work well with a selected row
			
			var addTime = this.selectedRow == this.addRow;
			var editedRow = addTime ? this.lastAddedRow : this.selectedRow;
			if(this.editRow)
				this.selectedRow.replaces(this.editRow);
			if(this.penaltyRow)
				this.penaltyRow.dispose();
			this.selectedRow = this.editRow = this.penaltyRow = null;
			
			//changing the time could very well affect more than this row
			//maybe someday we could be more efficient about the changes
			this.refreshData();
			this.resort(true);
			
			this.resize(); //changing the time may change the size of a column
			if(!addTime)
				this.scrollToRow(editedRow);
		}
		return row;
	},
	refreshData: function() {
		this.deselectRow();
		this.tbody.getChildren('tr').each(function(tr) {
			tr.refresh();
		});
		this.resort(true);
		this.infoRow.refresh();
		this.resize();
	},
	lastAddedRow: null,
	add: function(time) {
		var tr = this.push(['', '', '', '', '', '', '']).tr;
		this.lastAddedRow = tr;
		tr.addEvent('click', function(e) { this.rowClicked(e, tr, time); }.bind(this));
		var server = this.server;
		var session = this.session;
		var ras = this.ras;
		var THIS = this;
		tr.refresh = function() {
			var cells = this.getChildren();
			var col = -1;
			cells[++col].set('html', time.index + 1);
			
			cells[++col].set('html', time.format());
			cells[col].timeCentis = time.getValueCentis();
			cells[col].removeClass('bestRA');
			cells[col].removeClass('currentRA');
			cells[col].removeClass('topCurrentRA');
			cells[col].removeClass('bottomCurrentRA');
			cells[col].removeClass('bestTime');
			cells[col].removeClass('worstTime');
			var bw = session.bestWorst();
			if(time.index == bw.best.index)
				cells[col].addClass('bestTime');
			else if(time.index == bw.worst.index)
				cells[col].addClass('worstTime');
			var bestRA12 = session.bestWorst('ra12').best;
			var attemptCount = session.attemptCount();
			if(attemptCount >= 12) {
				if(bestRA12.index - 12 < time.index && time.index <= bestRA12.index) {
					cells[col].addClass('bestRA');
				}
				if(THIS.sorted.index == 0) {
					var firstSolve = session.attemptCount()-12;
					var lastSolve = session.attemptCount()-1;
					if(firstSolve <= time.index && time.index <= lastSolve)
						cells[col].addClass('currentRA');
					
					if(THIS.sorted.reverse) {
						//the top/bottom are switched
						var temp = lastSolve;
						lastSolve = firstSolve;
						firstSolve = temp;
					}
					
					if(time.index == firstSolve)
						cells[col].addClass('topCurrentRA');
					else if(time.index == lastSolve)
						cells[col].addClass('bottomCurrentRA');
				}
			}
			
			for(var i = 0; i < ras.length; i++) {
				var key = ras[i];
				cells[++col].set('html', server.formatTime(time[key]));
				var bestIndex = session.bestWorst(key).best.index;
				cells[col].removeClass('bestRA');
				if(bestIndex == time.index)
					cells[col].addClass('bestRA');
			}
			
			cells[++col].set('html', server.formatTime(time.sessionAve));
		};
		//tr.refresh();
		this.refreshData();
	},
	resize: function(forceScrollToLatest) {
		if(!this.session) return; //we're not ready to size this until we have a session
		
		//upon resizing, we first deselect any selected rows!
		if(this.selectedRow) {
			this.deselectRow();
			return; //the previous line will cause a resize
		}
		var maxSize = $(this).getParent().getSize();
		var offset = $(this).getPosition($(this).getParent());
		maxSize.y -= offset.y;
		
		var thead = $(this).getChildren('thead')[0];
		var tbody = $(this).getChildren('tbody')[0];
		var tfoot = $(this).getChildren('tfoot')[0];

		var infoCells = this.infoRow.getChildren('td');
		var addTimeCells = this.addRow.getChildren('td');
		var headers = thead.getChildren('tr')[0].getChildren('th');
		var tds = [];
		
		this.sizerRow.empty();
		tbody.adopt(this.sizerRow);
		for(var i = 0; i < headers.length; i++) {
			var col = new Element('td');
			tds.push(col);
			this.sizerRow.adopt(col);
		}

		//clearing all column widths
		tfoot.getChildren('tr').each(function(tr) {
			tr.setStyle('width', null);
		});
		tbody.setStyle('width', null); //we want everything to size itself as if there's enough space
		infoCells.each(function(td) {
			td.setStyle('width', null);
		});
		addTimeCells.each(function(td) {
			td.setStyle('width', null);
		});
		headers.each(function(td) {
			td.setStyle('width', null);
		});
		
		maxSize.y -= $(this).getStyle('margin-bottom').toInt();
		maxSize.y -= thead.getSize().y;
		maxSize.y -= tfoot.getSize().y;
		tbody.setStyle('height', maxSize.y);
		
		var preferredWidth = 0;
		
		var resizeme = [headers, infoCells, addTimeCells, tds];
		for(var i = 0; i < headers.length; i++) {
			var maxWidth = 0;
			var maxWidthIndex = 0;
			var padding = 0;
			for(var j = 0; j < resizeme.length; j++) {
				if(!resizeme[j]) continue;
				var newWidth = resizeme[j][i].getSize().x;
				if(newWidth >= maxWidth) {
					maxWidth = newWidth;
					maxWidthIndex = j;

					padding = resizeme[j][i].getStyle('padding-left').toInt() + resizeme[j][i].getStyle('padding-right').toInt() + 1; //add one for border
				}
			}
			preferredWidth += maxWidth;
			for(var j = 0; j < resizeme.length; j++) {
				//setting everyone to the max width
				if(!resizeme[j]) continue;
				resizeme[j][i].setStyle('width', maxWidth - padding);
			}
		}
		tfoot.getChildren('tr').each(function(tr) {
			tr.setStyle('width', preferredWidth+1); //add 1 for border?
		});

		//preferredWidth += 18; //this accounts for the vert scrollbar
		var width = tbody.getSize().x;
		if(tbody.clientHeight < tbody.scrollHeight) {
			//if there are vertical scrollbars
			width += 18;
		} 
		width = Math.min(width, maxSize.x);
		tbody.setStyle('width', width);
		
		if(this.freshSession) {
			this.freshSession = false;
			this.scrollToLastTime();
		} else if(forceScrollToLatest) {
			this.scrollToLastTime();
		}
		
	}
});
